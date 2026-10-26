import { pool } from '../lib/db.js';
import { fetchProfile, TikTokAuthError } from './client.js';
import { getAccessToken } from './tokens.js';

export interface Snapshot {
  followerCount: number;
  followingCount: number;
  takenAt: Date;
}

/** Gọi TikTok lấy số liệu mới nhất, lưu snapshot. Token chết -> đánh dấu mất theo dõi. */
export async function pollStats(userId: number): Promise<Snapshot> {
  try {
    const token = await getAccessToken(userId);
    const p = await fetchProfile(token);
    const { rows } = await pool.query(
      `insert into stat_snapshots (user_id, follower_count, following_count)
       values ($1, $2, $3) returning taken_at`,
      [userId, p.followerCount, p.followingCount],
    );
    await pool.query(
      `update users set display_name = $2, avatar_url = $3, tracking_ok = true where id = $1`,
      [userId, p.displayName, p.avatarUrl],
    );
    return { followerCount: p.followerCount, followingCount: p.followingCount, takenAt: rows[0].taken_at };
  } catch (e) {
    if (e instanceof TikTokAuthError) {
      await pool.query('update users set tracking_ok = false where id = $1', [userId]);
    }
    throw e;
  }
}

export async function lastSnapshot(userId: number): Promise<Snapshot | null> {
  const { rows } = await pool.query(
    `select follower_count, following_count, taken_at from stat_snapshots
     where user_id = $1 order by taken_at desc limit 1`,
    [userId],
  );
  const r = rows[0];
  return r ? { followerCount: r.follower_count, followingCount: r.following_count, takenAt: r.taken_at } : null;
}
