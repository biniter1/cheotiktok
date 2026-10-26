import { setTimeout as sleep } from 'node:timers/promises';
import { decrypt, encrypt } from '../lib/crypto.js';
import { pool, type Db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { refreshTokens, TikTokAuthError, type TokenSet } from './client.js';

export async function saveTokens(db: Db, userId: number, t: TokenSet): Promise<void> {
  await db.query(
    `insert into oauth_tokens (user_id, access_enc, refresh_enc, access_expires_at, refresh_expires_at, scope, updated_at)
     values ($1, $2, $3, now() + make_interval(secs => $4), now() + make_interval(secs => $5), $6, now())
     on conflict (user_id) do update set
       access_enc = excluded.access_enc, refresh_enc = excluded.refresh_enc,
       access_expires_at = excluded.access_expires_at, refresh_expires_at = excluded.refresh_expires_at,
       scope = excluded.scope, updated_at = now()`,
    [userId, encrypt(t.accessToken), encrypt(t.refreshToken), t.expiresIn, t.refreshExpiresIn, t.scope],
  );
}

/**
 * Lấy access token còn hạn, tự refresh khi sắp hết.
 * Nhiều worker/pod có thể cùng cần token của 1 user -> khoá Redis để chỉ 1 nơi refresh
 * (TikTok vô hiệu refresh token cũ sau khi refresh, refresh song song sẽ làm hỏng token).
 */
export async function getAccessToken(userId: number): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { rows } = await pool.query(
      `select access_enc, refresh_enc, access_expires_at > now() + interval '60 seconds' as fresh
       from oauth_tokens where user_id = $1`,
      [userId],
    );
    const row = rows[0];
    if (!row) throw new TikTokAuthError('no_token');
    if (row.fresh) return decrypt(row.access_enc);

    const lockKey = `lock:refresh:${userId}`;
    const got = await redis.set(lockKey, '1', 'EX', 15, 'NX');
    if (!got) {
      await sleep(500);
      continue;
    }
    try {
      const t = await refreshTokens(decrypt(row.refresh_enc));
      await saveTokens(pool, userId, t);
      return t.accessToken;
    } finally {
      await redis.del(lockKey);
    }
  }
  throw new Error('token_refresh_contention');
}
