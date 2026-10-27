import { pool } from '../lib/db.js';
import { AppError } from '../lib/errors.js';
import { liftExpiredSuspension, tierOf, type Tier } from './trust.js';

export interface UserRow {
  id: number;
  open_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  trust_score: number;
  warning: boolean;
  status: 'active' | 'suspended' | 'banned';
  banned_until: Date | null;
  role: 'user' | 'admin';
  tracking_ok: boolean;
}

export interface PublicProfile {
  id: number;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  trustScore: number;
  tier: Tier;
  warning: boolean;
}

export async function getUser(userId: number): Promise<UserRow> {
  await liftExpiredSuspension(pool, userId);
  const { rows } = await pool.query<UserRow>('select * from users where id = $1', [userId]);
  if (!rows[0]) throw new AppError('USER_NOT_FOUND', 404);
  return rows[0];
}

export function toPublic(u: UserRow): PublicProfile {
  return {
    id: u.id,
    displayName: u.display_name,
    username: u.username,
    avatarUrl: u.avatar_url,
    // Ưu tiên link dựng từ username: profile_web_link của API có thể là link chia sẻ dạng
    // /share/user/<id> mà app TikTok không mở được (gặp thực tế ở sandbox)
    profileUrl: u.username ? `https://www.tiktok.com/@${encodeURIComponent(u.username)}` : u.profile_url,
    trustScore: u.trust_score,
    tier: tierOf(u.trust_score),
    warning: u.warning,
  };
}

export async function getPublicProfiles(ids: number[]): Promise<Map<number, PublicProfile>> {
  const { rows } = await pool.query<UserRow>('select * from users where id = any($1::bigint[])', [ids]);
  return new Map(rows.map((u) => [u.id, toPublic(u)]));
}

/** Chặn hành động khi tài khoản bị khoá / mất quyền theo dõi */
export function assertCanParticipate(u: UserRow): void {
  if (u.status === 'banned') throw new AppError('ACCOUNT_BANNED', 403);
  if (u.status === 'suspended') throw new AppError('ACCOUNT_SUSPENDED', 403);
  if (!u.tracking_ok) throw new AppError('TRACKING_LOST', 403, 'Hãy đăng nhập lại TikTok để cấp quyền');
}
