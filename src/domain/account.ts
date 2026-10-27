import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { config } from '../config.js';
import { pool, tx } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { leaveQueue } from './matchmaking.js';

export function openIdHmac(openId: string): string {
  return crypto.createHmac('sha256', Buffer.from(config.tokenEncKey, 'base64')).update(openId).digest('hex');
}

/** Số follower/following mới nhất và thay đổi so với ~7 ngày trước (hiển thị cho chính chủ) */
export async function followerStats(userId: number) {
  const { rows } = await pool.query(
    `select cur.follower_count, cur.following_count, cur.taken_at,
       coalesce(
         (select follower_count from stat_snapshots
           where user_id = $1 and taken_at <= now() - interval '7 days' order by taken_at desc limit 1),
         (select follower_count from stat_snapshots
           where user_id = $1 order by taken_at asc limit 1)
       ) as base
     from (select follower_count, following_count, taken_at from stat_snapshots
           where user_id = $1 order by taken_at desc limit 1) cur`,
    [userId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    followerCount: r.follower_count as number,
    followingCount: r.following_count as number,
    followerDelta7d: (r.follower_count as number) - (r.base as number),
    statsTakenAt: (r.taken_at as Date).toISOString(),
  };
}

/** Người từng xoá tài khoản đăng ký lại: không cho điểm cao hơn 50 hoặc điểm lúc xoá */
export async function applyDeletedHistory(c: PoolClient, userId: number, openId: string): Promise<void> {
  const { rows } = await c.query(
    'delete from deleted_accounts where open_id_hmac = $1 returning trust_score',
    [openIdHmac(openId)],
  );
  if (rows[0]) {
    await c.query(
      `update users set trust_score = least(trust_score, $2), warning = least(trust_score, $2) < 30 where id = $1`,
      [userId, rows[0].trust_score],
    );
  }
}

/**
 * Xoá tài khoản theo yêu cầu: xoá token TikTok và toàn bộ số liệu đã thu thập,
 * xoá tên/ảnh/username. Giữ lại dòng user đã ẩn danh để lịch sử ghép cặp
 * của NGƯỜI KHÁC không bị hỏng, và HMAC open_id để chống "rửa điểm".
 */
export async function deleteAccount(userId: number): Promise<void> {
  await leaveQueue(userId).catch(() => {});
  await tx(async (c) => {
    const { rows } = await c.query('select open_id, trust_score from users where id = $1 for update', [userId]);
    const u = rows[0];
    if (!u || u.open_id.startsWith('deleted_')) return;
    await c.query(
      `insert into deleted_accounts (open_id_hmac, trust_score) values ($1, $2)
       on conflict (open_id_hmac) do update set trust_score = least(deleted_accounts.trust_score, excluded.trust_score), deleted_at = now()`,
      [openIdHmac(u.open_id), Math.min(u.trust_score, 50)],
    );
    await c.query('delete from oauth_tokens where user_id = $1', [userId]);
    await c.query('delete from stat_snapshots where user_id = $1', [userId]);
    await c.query(
      `update follows set status = 'broken', broken_at = now()
       where (follower_id = $1 or followee_id = $1) and status = 'active'`,
      [userId],
    );
    await c.query(
      `update suspicions set status = 'expired', resolved_at = now()
       where (suspect_id = $1 or victim_id = $1) and status = 'pending'`,
      [userId],
    );
    await c.query(
      `update users set open_id = 'deleted_' || id, display_name = null, username = null,
         avatar_url = null, profile_url = null, tracking_ok = false, status = 'banned'
       where id = $1`,
      [userId],
    );
  });
  await redis.del(`mm:seen:${userId}`, `mm:state:${userId}`, `presence:${userId}`);
}
