import { config } from '../config.js';
import { redis } from '../lib/redis.js';

const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const USERINFO_URL = 'https://open.tiktokapis.com/v2/user/info/';

export const SCOPES = 'user.info.basic,user.info.profile,user.info.stats';

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  openId: string;
  scope: string;
}

export interface Profile {
  openId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  followerCount: number;
  followingCount: number;
}

/** Token chết / bị thu hồi / thiếu scope — user phải đăng nhập lại */
export class TikTokAuthError extends Error {}

export function authorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_key: config.tiktok.clientKey,
    scope: SCOPES,
    response_type: 'code',
    redirect_uri: config.tiktok.redirectUri,
    state,
  });
  return `${AUTH_URL}?${p}`;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: config.tiktok.clientKey,
      client_secret: config.tiktok.clientSecret,
      ...body,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || j.error) {
    throw new TikTokAuthError(j.error_description ?? j.error ?? `token HTTP ${res.status}`);
  }
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresIn: j.expires_in,
    refreshExpiresIn: j.refresh_expires_in,
    openId: j.open_id,
    scope: j.scope ?? '',
  };
}

export function exchangeCode(code: string): Promise<TokenSet> {
  if (config.tiktokMock) return Promise.resolve(mockTokens(code));
  return tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: config.tiktok.redirectUri });
}

export function refreshTokens(refreshToken: string): Promise<TokenSet> {
  if (config.tiktokMock) return Promise.resolve(mockTokens(refreshToken.replace(/^mockr:/, '')));
  return tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
}

export async function fetchProfile(accessToken: string): Promise<Profile> {
  if (config.tiktokMock) return mockProfile(accessToken);
  const fields = 'open_id,display_name,avatar_url,username,profile_web_link,follower_count,following_count';
  const res = await fetch(`${USERINFO_URL}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8_000),
  });
  const j: any = await res.json().catch(() => ({}));
  const code: string | undefined = j?.error?.code;
  if (res.status === 401 || code === 'access_token_invalid' || code === 'scope_not_authorized') {
    throw new TikTokAuthError(code ?? 'unauthorized');
  }
  if (!res.ok || (code && code !== 'ok')) {
    // 429 / 5xx: lỗi tạm thời -> BullMQ sẽ retry
    throw new Error(`TikTok user/info failed: ${code ?? res.status}`);
  }
  const u = j.data.user;
  return {
    openId: u.open_id,
    displayName: u.display_name,
    username: u.username ?? null,
    avatarUrl: u.avatar_url ?? null,
    profileUrl: u.profile_web_link ?? null,
    followerCount: u.follower_count,
    followingCount: u.following_count,
  };
}

/* ------------------------------------------------------------------ *
 * MOCK: số liệu giả lưu trong Redis hash  mock:stats:<openId>        *
 * Dùng cho dev/load test: /dev/mock-follow để giả lập hành động follow *
 * ------------------------------------------------------------------ */

function mockTokens(openId: string): TokenSet {
  return {
    accessToken: `mock:${openId}`,
    refreshToken: `mockr:${openId}`,
    expiresIn: 86_400,
    refreshExpiresIn: 31_536_000,
    openId,
    scope: SCOPES,
  };
}

async function mockProfile(accessToken: string): Promise<Profile> {
  const openId = accessToken.replace(/^mock:/, '');
  const key = `mock:stats:${openId}`;
  await redis.hsetnx(key, 'follower', '100');
  await redis.hsetnx(key, 'following', '100');
  const s = await redis.hgetall(key);
  return {
    openId,
    displayName: `Mock ${openId}`,
    username: openId,
    avatarUrl: null,
    profileUrl: `https://www.tiktok.com/@${openId}`,
    followerCount: Number(s.follower),
    followingCount: Number(s.following),
  };
}

/** Giả lập: openId A follow (+1) hoặc unfollow (-1) openId B */
export async function mockFollow(fromOpenId: string, toOpenId: string, dir: 1 | -1): Promise<void> {
  await redis
    .multi()
    .hincrby(`mock:stats:${fromOpenId}`, 'following', dir)
    .hincrby(`mock:stats:${toOpenId}`, 'follower', dir)
    .exec();
}
