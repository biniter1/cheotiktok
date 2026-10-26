import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { parse as parseCookie } from 'cookie';
import { Server } from 'socket.io';
import { config } from '../config.js';
import { errCode } from '../lib/errors.js';
import { createRedis } from '../lib/redis.js';
import { SESSION_COOKIE, verifySession } from '../lib/session.js';
import { confirmMatch, joinQueue, leaveQueue, touchPresence } from '../domain/matchmaking.js';

type Ack = (res: unknown) => void;

/**
 * Socket.IO chạy NHIỀU instance:
 *  - redis-adapter: event phát ở pod này tới được socket đang nằm ở pod khác
 *  - transports chỉ 'websocket': không cần sticky session ở load balancer
 *    (long-polling của Socket.IO bắt buộc sticky, websocket thì không)
 */
export function setupRealtime(httpServer: HttpServer): Server {
  const pub = createRedis();
  const sub = pub.duplicate();
  const io = new Server(httpServer, {
    transports: ['websocket'],
    cors: { origin: config.frontendUrl, credentials: true },
    adapter: createAdapter(pub, sub),
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });

  io.use((socket, next) => {
    const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
    const uid = verifySession(cookies[SESSION_COOKIE]);
    if (!uid) return next(new Error('UNAUTHORIZED'));
    socket.data.uid = uid;
    next();
  });

  const safe = (fn: () => Promise<unknown>, ack?: Ack) =>
    fn()
      .then((r) => ack?.({ ok: true, ...(r as object) }))
      .catch((e) => {
        if (errCode(e) === 'INTERNAL') console.error(e);
        ack?.({ ok: false, error: errCode(e) });
      });

  io.on('connection', (socket) => {
    const uid: number = socket.data.uid;
    socket.join(`user:${uid}`);
    void touchPresence(uid).catch(() => {});

    socket.on('heartbeat', () => void touchPresence(uid).catch(() => {}));
    socket.on('queue:join', (ack?: Ack) => safe(() => joinQueue(uid), ack));
    socket.on('queue:leave', (ack?: Ack) => safe(() => leaveQueue(uid), ack));
    socket.on('match:confirm', (p: { matchId?: number }, ack?: Ack) =>
      safe(() => confirmMatch(uid, Number(p?.matchId)), ack));

    socket.on('disconnect', async () => {
      // user có thể mở nhiều tab/thiết bị: chỉ rời hàng chờ khi không còn socket nào
      const remaining = await io.in(`user:${uid}`).fetchSockets().catch(() => []);
      if (remaining.length === 0) await leaveQueue(uid).catch(() => {});
    });
  });

  return io;
}
