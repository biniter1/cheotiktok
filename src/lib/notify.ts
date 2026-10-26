import { Emitter } from '@socket.io/redis-emitter';
import { createRedis } from './redis.js';

/**
 * Bắn event tới user qua Redis — chạy được ở BẤT KỲ process nào (API hay worker).
 * Mọi instance API có redis-adapter sẽ nhận và đẩy xuống đúng socket của user,
 * dù user đang kết nối vào pod nào.
 */
const emitter = new Emitter(createRedis());

export function notify(userId: number, event: string, data: unknown): void {
  emitter.to(`user:${userId}`).emit(event, data);
}
