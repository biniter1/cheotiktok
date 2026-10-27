import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { tx } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from '../lib/session.js';
import { authorizeUrl, exchangeCode, fetchProfile, type TokenSet } from '../tiktok/client.js';
import { saveTokens } from '../tiktok/tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    uid: number;
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const uid = verifySession(req.cookies[SESSION_COOKIE]);
  if (!uid) {
    await reply.code(401).send({ error: 'UNAUTHORIZED' });
    return;
  }
  req.uid = uid;
}

/** Tạo/cập nhật user từ token TikTok, lưu token (mã hoá), snapshot số liệu đầu tiên */
async function upsertFromTokens(tokens: TokenSet): Promise<{ id: number; status: string }> {
  const p = await fetchProfile(tokens.accessToken);
  return tx(async (c) => {
    const { rows } = await c.query(
      `insert into users (open_id, display_name, username, avatar_url, profile_url, tracking_ok, last_seen_at)
       values ($1, $2, $3, $4, $5, true, now())
       on conflict (open_id) do update set
         display_name = excluded.display_name, username = excluded.username,
         avatar_url = excluded.avatar_url, profile_url = excluded.profile_url,
         tracking_ok = true, last_seen_at = now()
       returning id, status`,
      [p.openId, p.displayName, p.username, p.avatarUrl, p.profileUrl],
    );
    const user = rows[0];
    await saveTokens(c, user.id, tokens);
    await c.query(
      'insert into stat_snapshots (user_id, follower_count, following_count) values ($1, $2, $3)',
      [user.id, p.followerCount, p.followingCount],
    );
    return user;
  });
}

function setSession(reply: FastifyReply, userId: number): void {
  reply.setCookie(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export function registerAuth(app: FastifyInstance): void {
  app.decorateRequest('uid', 0);

  app.get('/auth/tiktok', async (req, reply) => {
    if (config.tiktokMock) {
      // Chạy thử: mỗi trình duyệt bấm đăng nhập = một người dùng thử mới (hoặc ?as=ten để đăng nhập lại)
      const as = (req.query as { as?: string }).as;
      const openId = as && /^[a-z0-9_]{1,40}$/i.test(as) ? as : `thu_${crypto.randomBytes(3).toString('hex')}`;
      const user = await upsertFromTokens(await exchangeCode(openId));
      if (user.status === 'banned') return reply.redirect(`${config.frontendUrl}/login?error=banned`);
      setSession(reply, user.id);
      return reply.redirect(`${config.frontendUrl}/zone`);
    }
    const state = crypto.randomBytes(16).toString('hex');
    await redis.set(`oauth:state:${state}`, '1', 'EX', 600);
    return reply.redirect(authorizeUrl(state));
  });

  app.get('/auth/tiktok/callback', async (req, reply) => {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    const fail = (reason: string) => reply.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(reason)}`);

    if (error || !code || !state) return fail(error ?? 'missing_code');
    // state dùng 1 lần (chống CSRF / replay)
    if (!(await redis.del(`oauth:state:${state}`))) return fail('invalid_state');

    const tokens = await exchangeCode(code);
    // user có thể bỏ tick quyền stats trên màn hình TikTok -> không theo dõi được thì không cho vào
    if (!tokens.scope.split(',').includes('user.info.stats')) return fail('need_stats_scope');

    const user = await upsertFromTokens(tokens);
    if (user.status === 'banned') return fail('banned');
    setSession(reply, user.id);
    return reply.redirect(`${config.frontendUrl}/zone`);
  });

  app.post('/auth/logout', async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  // Đăng nhập giả lập — CHỈ bật khi TIKTOK_MOCK=1 (dev / load test)
  if (config.tiktokMock) {
    app.post('/auth/dev-login', async (req, reply) => {
      const { openId } = (req.body ?? {}) as { openId?: string };
      if (!openId || !/^[a-z0-9_]{1,40}$/i.test(openId)) return reply.code(400).send({ error: 'BAD_OPEN_ID' });
      const user = await upsertFromTokens(await exchangeCode(openId));
      if (user.status === 'banned') return reply.code(403).send({ error: 'ACCOUNT_BANNED' });
      setSession(reply, user.id);
      return { userId: user.id };
    });
  }
}
