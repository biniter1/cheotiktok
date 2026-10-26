import { Queue } from 'bullmq';
import { createRedis } from './redis.js';

const connection = createRedis();

/** Job nghiệp vụ: verify-match, match-timeout, correlate, retention, poll-scheduler */
export const jobsQueue = new Queue('jobs', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

/** Job gọi TikTok API lấy số liệu — tách queue riêng để rate-limit toàn cụm */
export const pollQueue = new Queue('poll', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
