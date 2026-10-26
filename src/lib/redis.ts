import { Redis } from 'ioredis';
import { config } from '../config.js';

/** BullMQ yêu cầu maxRetriesPerRequest = null */
export function createRedis(): Redis {
  return new Redis(config.redisUrl, { maxRetriesPerRequest: null });
}

export const redis = createRedis();
