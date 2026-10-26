import { config } from '../config.js';
import { pool, tx } from '../lib/db.js';
import { AppError } from '../lib/errors.js';
import { notify } from '../lib/notify.js';
import { jobsQueue } from '../lib/queues.js';
import { redis } from '../lib/redis.js';
import { pollStats } from '../tiktok/stats.js';
import { applyTrust, tierOf, TIERS } from './trust.js';
import { assertCanParticipate, getPublicProfiles, getUser } from './users.js';

/*
 * Cấu trúc Redis:
 *   presence:<uid>       đang online (TTL, client gửi heartbeat)
 *   mm:queue:<tier>      ZSET hàng chờ theo tầng uy tín, score = thời điểm vào hàng
 *   mm:state:<uid>       queued:<tier> | pairing | matched:<matchId>
 *   mm:seen:<uid>        SET những người đã từng ghép (không ghép lại lần 2)
 *
 * Ghép cặp chạy trong 1 Lua script => ATOMIC trên Redis.
 * Dù có 10 pod API cùng xử lý, 1 người không bao giờ bị ghép với 2 người cùng lúc.
 * (Lưu ý: script đọc key ngoài KEYS -> dùng Redis đơn / Sentinel, không dùng Redis Cluster.)
 */
export const PRESENCE_TTL_SEC = 30;

const PAIR_LUA = `
local uid = ARGV[1]
local st = redis.call('GET', 'mm:state:' .. uid)
if st and (string.sub(st, 1, 7) == 'pairing' or string.sub(st, 1, 7) == 'matched') then
  return {'BUSY', st}
end
for i = 2, #KEYS do redis.call('ZREM', KEYS[i], uid) end
local cands = redis.call('ZRANGE', KEYS[1], 0, tonumber(ARGV[3]) - 1)
for _, c in ipairs(cands) do
  if c ~= uid then
    if redis.call('EXISTS', 'presence:' .. c) == 0 then
      redis.call('ZREM', KEYS[1], c)
      redis.call('DEL', 'mm:state:' .. c)
    elseif redis.call('SISMEMBER', 'mm:seen:' .. uid, c) == 0 then
      redis.call('ZREM', KEYS[1], c)
      redis.call('SET', 'mm:state:' .. uid, 'pairing', 'EX', 60)
      redis.call('SET', 'mm:state:' .. c, 'pairing', 'EX', 60)
      return {'PAIRED', c}
    end
  end
end
redis.call('ZADD', KEYS[1], ARGV[2], uid)
redis.call('SET', 'mm:state:' .. uid, ARGV[4])
return {'QUEUED', ''}
`;

redis.defineCommand('mmPair', { numberOfKeys: 1 + TIERS.length, lua: PAIR_LUA });
type PairResult = [string, string];
const mmPair = (...args: (string | number)[]) =>
  (redis as unknown as { mmPair: (...a: (string | number)[]) => Promise<PairResult> }).mmPair(...args);

const queueKey = (tier: string) => `mm:queue:${tier}`;

export async function touchPresence(userId: number): Promise<void> {
  await redis.set(`presence:${userId}`, '1', 'EX', PRESENCE_TTL_SEC);
  // cập nhật last_seen vào DB tối đa 5 phút/lần để không dội tải Postgres
  if (await redis.set(`lastseen:${userId}`, '1', 'EX', 300, 'NX')) {
    await pool.query('update users set last_seen_at = now() where id = $1', [userId]);
  }
}

export type JoinResult =
  | { status: 'queued'; tier: string }
  | { status: 'matched'; matchId: number }
  | { status: 'busy'; state: string };

export async function joinQueue(userId: number): Promise<JoinResult> {
  const u = await getUser(userId);
  assertCanParticipate(u);
  await touchPresence(userId);

  const tier = tierOf(u.trust_score);
  const [kind, val] = await mmPair(
    queueKey(tier), ...TIERS.map(queueKey),
    String(userId), Date.now(), 50, `queued:${tier}`,
  );
  if (kind === 'BUSY') return { status: 'busy', state: val };
  if (kind === 'QUEUED') return { status: 'queued', tier };

  const matchId = await createMatch(Number(val), userId);
  return { status: 'matched', matchId };
}

export async function leaveQueue(userId: number): Promise<void> {
  const multi = redis.multi();
  for (const t of TIERS) multi.zrem(queueKey(t), String(userId));
  await multi.exec();
  const st = await redis.get(`mm:state:${userId}`);
  if (st?.startsWith('queued')) await redis.del(`mm:state:${userId}`);
}

async function createMatch(a: number, b: number): Promise<number> {
  try {
    // snapshot following_count NGAY lúc ghép làm mốc để so sánh
    const [sa, sb] = await Promise.all([pollStats(a), pollStats(b)]);
    const { rows } = await pool.query(
      `insert into matches (user_a, user_b, a_base_following, b_base_following)
       values ($1, $2, $3, $4) returning id`,
      [a, b, sa.followingCount, sb.followingCount],
    );
    const matchId: number = rows[0].id;
    const ttl = config.match.confirmTimeoutSec + 300;
    await redis
      .multi()
      .set(`mm:state:${a}`, `matched:${matchId}`, 'EX', ttl)
      .set(`mm:state:${b}`, `matched:${matchId}`, 'EX', ttl)
      .sadd(`mm:seen:${a}`, String(b))
      .sadd(`mm:seen:${b}`, String(a))
      .exec();

    const profiles = await getPublicProfiles([a, b]);
    const payload = (partner: number) => ({
      matchId,
      partner: profiles.get(partner),
      timeoutSec: config.match.confirmTimeoutSec,
    });
    notify(a, 'match:found', payload(b));
    notify(b, 'match:found', payload(a));

    await jobsQueue.add('match-timeout', { matchId }, {
      delay: config.match.confirmTimeoutSec * 1000,
      jobId: `timeout-${matchId}`,
    });
    return matchId;
  } catch (e) {
    await redis.del(`mm:state:${a}`, `mm:state:${b}`);
    notify(a, 'match:error', { retry: true });
    notify(b, 'match:error', { retry: true });
    throw e;
  }
}

/** User bấm "Đã follow" */
export async function confirmMatch(userId: number, matchId: number): Promise<{ bothConfirmed: boolean }> {
  const { rows } = await pool.query(
    `update matches set
       a_confirmed = a_confirmed or (user_a = $2),
       b_confirmed = b_confirmed or (user_b = $2)
     where id = $1 and status = 'pending' and (user_a = $2 or user_b = $2)
     returning user_a, user_b, a_confirmed, b_confirmed`,
    [matchId, userId],
  );
  const m = rows[0];
  if (!m) throw new AppError('MATCH_NOT_PENDING', 409);
  const other = m.user_a === userId ? m.user_b : m.user_a;
  notify(other, 'match:partner_confirmed', { matchId });

  const bothConfirmed = m.a_confirmed && m.b_confirmed;
  if (bothConfirmed) {
    await jobsQueue.add('verify-match', { matchId }, {
      delay: config.match.verifyGraceSec * 1000,
      jobId: `verify-${matchId}`,
    });
  }
  return { bothConfirmed };
}

/** Chạy ở worker: so sánh following_count với mốc lúc ghép, chấm điểm, ghi quan hệ follow */
export async function verifyMatch(matchId: number): Promise<void> {
  const { rows } = await pool.query(
    `update matches set status = 'verifying' where id = $1 and status = 'pending' returning *`,
    [matchId],
  );
  const m = rows[0];
  if (!m) return; // đã xử lý bởi job khác (timeout vs verify) -> idempotent

  let sa, sb;
  try {
    [sa, sb] = await Promise.all([pollStats(m.user_a), pollStats(m.user_b)]);
  } catch (e) {
    await pool.query(`update matches set status = 'pending' where id = $1`, [matchId]);
    throw e; // BullMQ retry
  }

  const aFollowed = sa.followingCount > m.a_base_following;
  const bFollowed = sb.followingCount > m.b_base_following;
  const nobodyActed = !aFollowed && !bFollowed && !m.a_confirmed && !m.b_confirmed;
  const status = nobodyActed ? 'expired'
    : aFollowed && bFollowed ? 'ok'
    : aFollowed || bFollowed ? 'partial'
    : 'failed';

  const sides = [
    { uid: m.user_a as number, other: m.user_b as number, followed: aFollowed, confirmed: m.a_confirmed as boolean, otherFollowed: bFollowed },
    { uid: m.user_b as number, other: m.user_a as number, followed: bFollowed, confirmed: m.b_confirmed as boolean, otherFollowed: aFollowed },
  ];

  await tx(async (c) => {
    await c.query(
      `update matches set status = $2, a_followed = $3, b_followed = $4, resolved_at = now() where id = $1`,
      [matchId, status, aFollowed, bFollowed],
    );
    for (const s of sides) {
      if (s.followed) {
        await c.query(
          `insert into follows (follower_id, followee_id) values ($1, $2)
           on conflict (follower_id, followee_id) do update
             set status = 'active', since = now(), broken_at = null, bonus7 = false, bonus30 = false`,
          [s.uid, s.other],
        );
      }
      if (status === 'ok') await applyTrust(c, s.uid, 'MATCH_OK', matchId);
      else if (!s.followed && s.confirmed) await applyTrust(c, s.uid, 'FAKE_CONFIRM', matchId);
      else if (!s.followed && s.otherFollowed) await applyTrust(c, s.uid, 'NO_FOLLOW', matchId);
    }
  });

  await redis.del(`mm:state:${m.user_a}`, `mm:state:${m.user_b}`);
  for (const s of sides) {
    notify(s.uid, 'match:result', {
      matchId,
      status,
      youFollowed: s.followed,
      partnerFollowed: s.otherFollowed,
      // đối phương không follow lại -> gợi ý user tự unfollow lại cho công bằng
      hint: s.followed && !s.otherFollowed ? 'PARTNER_DID_NOT_FOLLOW_BACK' : undefined,
    });
  }
}

/** Hết thời gian xác nhận mà match vẫn pending -> verify luôn */
export async function onMatchTimeout(matchId: number): Promise<void> {
  const { rows } = await pool.query(`select status from matches where id = $1`, [matchId]);
  if (rows[0]?.status === 'pending') await verifyMatch(matchId);
}
