import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { config } from './config.js';
import { pool } from './lib/db.js';
import { AppError } from './lib/errors.js';
import { createRedis, redis } from './lib/redis.js';
import { registerApi } from './http/api.js';
import { registerAuth } from './http/auth.js';
import { setupRealtime } from './http/realtime.js';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, trustProxy: true });
let shuttingDown = false;

await app.register(cookie);
await app.register(cors, { origin: config.frontendUrl, credentials: true });
// rate limit dùng chung Redis -> giới hạn đúng trên toàn cụm, không phải từng pod
await app.register(rateLimit, {
  max: Number(process.env.RATE_LIMIT_PER_MIN ?? 120),
  timeWindow: '1 minute',
  redis: createRedis(),
  allowList: (req) => req.url === '/healthz' || req.url === '/readyz',
});

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof AppError) return reply.code(err.status).send({ error: err.code, message: err.message });
  const sc = (err as { statusCode?: number }).statusCode;
  if (sc === 429) return reply.code(429).send({ error: 'RATE_LIMITED' });
  // lỗi phía client do Fastify sinh ra (body sai, JSON hỏng...) giữ nguyên mã 4xx
  if (sc && sc >= 400 && sc < 500) {
    const fe = err as { code?: string; message?: string };
    return reply.code(sc).send({ error: fe.code ?? 'BAD_REQUEST', message: fe.message });
  }
  app.log.error(err);
  return reply.code(500).send({ error: 'INTERNAL' });
});

// liveness: process còn sống
app.get('/healthz', async () => ({ ok: true }));
// readiness: phụ thuộc OK và không đang tắt -> LB/K8s mới đẩy traffic vào
app.get('/readyz', async (_req, reply) => {
  if (shuttingDown) return reply.code(503).send({ ok: false, reason: 'shutting_down' });
  try {
    await Promise.all([pool.query('select 1'), redis.ping()]);
    return { ok: true };
  } catch {
    return reply.code(503).send({ ok: false });
  }
});

registerAuth(app);
registerApi(app);

await app.listen({ port: config.port, host: '0.0.0.0' });
const io = setupRealtime(app.server);

/**
 * Tắt êm (rolling update / scale down không làm rớt request):
 * báo not-ready -> chờ LB rút pod -> đóng socket (client tự nối lại sang pod khác) -> đóng HTTP/DB
 */
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'shutting down');
  await new Promise((r) => setTimeout(r, Number(process.env.SHUTDOWN_DRAIN_MS ?? 5000)));
  io.close();
  await app.close();
  await pool.end();
  redis.disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
