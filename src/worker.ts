import { Worker, type Job } from 'bullmq';
import { config } from './config.js';
import { pool } from './lib/db.js';
import { jobsQueue } from './lib/queues.js';
import { createRedis } from './lib/redis.js';
import { onMatchTimeout, verifyMatch } from './domain/matchmaking.js';
import { correlate, pollAndDetect, retentionBonuses, schedulePolls } from './domain/tracking.js';

/**
 * Worker không giữ state -> chạy bao nhiêu bản cũng được.
 * BullMQ đảm bảo mỗi job chỉ 1 worker nhận; job lỗi tự retry có backoff.
 */
const jobsWorker = new Worker(
  'jobs',
  async (job: Job) => {
    switch (job.name) {
      case 'verify-match': return verifyMatch(job.data.matchId);
      case 'match-timeout': return onMatchTimeout(job.data.matchId);
      case 'correlate': return correlate(job.data.dropEventId);
      case 'poll-scheduler': return { scheduled: await schedulePolls() };
      case 'retention': return retentionBonuses();
      default: throw new Error(`unknown job ${job.name}`);
    }
  },
  { connection: createRedis(), concurrency: Number(process.env.JOBS_CONCURRENCY ?? 20) },
);

const pollWorker = new Worker(
  'poll',
  async (job: Job) => pollAndDetect(job.data.userId),
  {
    connection: createRedis(),
    concurrency: Number(process.env.POLL_CONCURRENCY ?? 10),
    // limiter của BullMQ là toàn cục cho cả queue -> thêm worker không vượt quota TikTok API
    limiter: { max: config.poll.maxPerMinute, duration: 60_000 },
  },
);

for (const w of [jobsWorker, pollWorker]) {
  w.on('failed', (job, err) => console.error(`[${w.name}] ${job?.name}#${job?.id} failed:`, err.message));
}

// Lịch định kỳ: upsert idempotent -> nhiều worker cùng khởi động cũng chỉ có 1 lịch
await jobsQueue.upsertJobScheduler('poll-scheduler', { every: config.poll.intervalMin * 60_000 }, { name: 'poll-scheduler' });
await jobsQueue.upsertJobScheduler('retention', { pattern: '0 3 * * *', tz: 'Asia/Ho_Chi_Minh' }, { name: 'retention' });

console.log('worker started');

async function shutdown() {
  // chờ job đang chạy xong rồi mới thoát (không bỏ dở verify giữa chừng)
  await Promise.all([jobsWorker.close(), pollWorker.close()]);
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
