import type { PoolClient } from 'pg';

/** Bảng cộng/trừ điểm. Chỉnh ở đây là đổi luật toàn hệ thống. */
export const TRUST_DELTA = {
  MATCH_OK: 1,            // cả hai follow nhau thành công
  RETAIN_7D: 2,           // giữ follow 7 ngày
  RETAIN_30D: 5,          // giữ follow 30 ngày
  NO_FOLLOW: -2,          // đối phương đã follow mà mình không follow lại
  FAKE_CONFIRM: -5,       // bấm "Đã follow" nhưng thật ra không follow
  UNFOLLOW_CONFIRMED: -10,// unfollow được chủ tài khoản xác nhận (có đối chiếu chéo)
  FALSE_REPORT: -5,       // xác nhận sai, bị kháng cáo lật lại
  APPEAL_REFUND: 10,      // hoàn điểm khi kháng cáo thành công
  ADMIN_ADJUST: 0,
} as const;

export type TrustReason = keyof typeof TRUST_DELTA;

const DAILY_MATCH_BONUS_CAP = 20;     // chống cày điểm bằng cách ghép liên tục
const WARNING_BELOW = 30;
const SUSPEND_BELOW = 10;
const SUSPEND_DAYS = 7;
const PERMA_BAN_CONFIRMED_UNFOLLOWS = 5;

export type Tier = 'low' | 'mid' | 'high';
export const TIERS: Tier[] = ['low', 'mid', 'high'];

export function tierOf(score: number): Tier {
  if (score < 40) return 'low';
  if (score < 70) return 'mid';
  return 'high';
}

/** Cộng/trừ điểm trong transaction, ghi sổ cái và áp thang xử phạt. Trả về điểm mới. */
export async function applyTrust(
  c: PoolClient,
  userId: number,
  reason: TrustReason,
  refId?: number,
  overrideDelta?: number,
): Promise<number> {
  let delta: number = overrideDelta ?? TRUST_DELTA[reason];

  if (reason === 'MATCH_OK') {
    const { rows } = await c.query(
      `select count(*)::int n from trust_ledger
       where user_id = $1 and reason = 'MATCH_OK' and delta > 0 and created_at > now() - interval '1 day'`,
      [userId],
    );
    if (rows[0].n >= DAILY_MATCH_BONUS_CAP) delta = 0;
  }

  // khoá dòng user để các thay đổi điểm đồng thời không ghi đè nhau
  const { rows } = await c.query(
    `update users set trust_score = greatest(0, least(100, trust_score + $2))
     where id = $1 returning trust_score`,
    [userId, delta],
  );
  await c.query(
    'insert into trust_ledger (user_id, delta, reason, ref_id) values ($1, $2, $3, $4)',
    [userId, delta, reason, refId ?? null],
  );
  const score: number = rows[0].trust_score;
  await evaluateSanctions(c, userId, score);
  return score;
}

/**
 * Thang xử phạt:
 *  - điểm < 30  -> gắn cảnh báo (badge ⚠ ai cũng thấy khi được ghép)
 *  - điểm < 40  -> tự rơi xuống pool "low" (qua tierOf)
 *  - điểm < 10  -> khoá tạm 7 ngày
 *  - >= 5 lần unfollow bị xác nhận -> cấm vĩnh viễn (theo open_id)
 */
export async function evaluateSanctions(c: PoolClient, userId: number, score: number): Promise<void> {
  const { rows } = await c.query(
    `select count(*)::int n from suspicions where suspect_id = $1 and status = 'confirmed'`,
    [userId],
  );
  if (rows[0].n >= PERMA_BAN_CONFIRMED_UNFOLLOWS) {
    await c.query(`update users set status = 'banned', warning = true where id = $1`, [userId]);
    return;
  }
  if (score < SUSPEND_BELOW) {
    await c.query(
      `update users set status = 'suspended', banned_until = now() + make_interval(days => $2)
       where id = $1 and status = 'active'`,
      [userId, SUSPEND_DAYS],
    );
  }
  await c.query('update users set warning = $2 where id = $1', [userId, score < WARNING_BELOW]);
}

/** Gọi khi user đăng nhập / vào zone: hết hạn khoá tạm thì mở lại, cho điểm sàn để thoát vòng khoá */
export async function liftExpiredSuspension(c: PoolClient | import('pg').Pool, userId: number): Promise<void> {
  await c.query(
    `update users set status = 'active', banned_until = null, trust_score = greatest(trust_score, 15)
     where id = $1 and status = 'suspended' and banned_until < now()`,
    [userId],
  );
}
