function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing env ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  isProd: process.env.NODE_ENV === 'production',
  databaseUrl: env('DATABASE_URL'),
  redisUrl: env('REDIS_URL'),
  jwtSecret: env('JWT_SECRET'),
  /** 32 byte key, base64 — dùng để mã hoá access/refresh token TikTok trong DB */
  tokenEncKey: env('TOKEN_ENC_KEY'),
  frontendUrl: env('FRONTEND_URL', 'http://localhost:5173'),
  /** TIKTOK_MOCK=1: giả lập TikTok API để dev và load test, KHÔNG bật ở production */
  tiktokMock: process.env.TIKTOK_MOCK === '1',
  tiktok: {
    clientKey: process.env.TIKTOK_CLIENT_KEY ?? '',
    clientSecret: process.env.TIKTOK_CLIENT_SECRET ?? '',
    redirectUri: process.env.TIKTOK_REDIRECT_URI ?? '',
  },
  match: {
    confirmTimeoutSec: Number(process.env.MATCH_CONFIRM_TIMEOUT_SEC ?? 90),
    /** chờ thêm vài giây sau khi cả hai bấm xác nhận, vì số liệu TikTok có độ trễ */
    verifyGraceSec: Number(process.env.MATCH_VERIFY_GRACE_SEC ?? 15),
  },
  poll: {
    intervalMin: Number(process.env.POLL_INTERVAL_MIN ?? 15),
    /** giới hạn gọi TikTok API toàn cụm (mọi worker cộng lại) */
    maxPerMinute: Number(process.env.POLL_MAX_PER_MIN ?? 300),
    correlateDelaySec: Number(process.env.CORRELATE_DELAY_SEC ?? 180),
  },
};

if (!config.tiktokMock && (!config.tiktok.clientKey || !config.tiktok.clientSecret || !config.tiktok.redirectUri)) {
  throw new Error('Missing TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REDIRECT_URI (or set TIKTOK_MOCK=1 for dev)');
}
if (config.tiktokMock && config.isProd) {
  throw new Error('TIKTOK_MOCK must not be enabled in production');
}
