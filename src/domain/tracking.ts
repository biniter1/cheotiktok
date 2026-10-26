import { config } from '../config.js';
import { pool, tx } from '../lib/db.js';
import { notify } from '../lib/notify.js';
import { jobsQueue, pollQueue } from '../lib/queues.js';
import { lastSnapshot, pollStats } from '../tiktok/stats.js';
import { applyTrust } from './trust.js';
import { getPublicProfiles } from './users.js';

/**
 * LỚP 1 — phát hiện tụt follower.
 * So snapshot mới với snapshot trước; tụt -> tạo drop_event, poll gấp toàn bộ
 * "partner" (những người hệ thống xác minh đang follow user này), rồi hẹn lịch đối chiếu.
 */
export async function pollAndDetect(userId: number): Promise<void> {
  const prev = await lastSnapshot(userId);
  const cur = await pollStats(userId);
  if (!prev || cur.followerCount >= prev.followerCount) return;

  const { rows } = await pool.query(
    `insert into drop_events (user_id, prev_count, new_count, window_start, window_end)
     values ($1, $2, $3, $4, $5) returning id`,
    [userId, prev.followerCount, cur.followerCount, prev.takenAt, cur.takenAt],
  );
  const dropId: number = rows[0].id;

  const partners = await pool.query<{ follower_id: number }>(
    `select follower_id from follows where followee_id = $1 and status = 'active'`,
    [userId],
  );
  if (partners.rows.length > 0) {
    // priority 1 = cao nhất trong BullMQ -> chen trước các poll định kỳ
    await pollQueue.addBulk(partners.rows.map((r) => ({
      name: 'poll-user',
      data: { userId: r.follower_id },
      opts: { priority: 1 },
    })));
  }
  await jobsQueue.add('correlate', { dropEventId: dropId }, {
    delay: config.poll.correlateDelaySec * 1000,
    jobId: `correlate-${dropId}`,
  });
}

/**
 * LỚP 2 — đối chiếu chéo.
 * Trong số partner đang follow nạn nhân, ai có following_count GIẢM quanh khung thời gian
 * nạn nhân tụt follower => nghi phạm. Kết quả gửi cho nạn nhân tự xác nhận (LỚP 3).
 */
export async function correlate(dropEventId: number): Promise<void> {
  const { rows: evRows } = await pool.query(
    `update drop_events set correlated = true where id = $1 and not correlated returning *`,
    [dropEventId],
  );
  const ev = evRows[0];
  if (!ev) return;

  const { rows } = await pool.query<{ suspect_id: number; delta: number }>(
    `with partners as (
       select follower_id as pid from follows where followee_id = $1 and status = 'active'
     ),
     -- "trước" = following CAO NHẤT của nghi phạm trong cửa sổ [đầu cửa sổ - 1 phút, cuối cửa sổ].
     -- Không lấy 1 snapshot đơn lẻ: snapshot chụp gần như đồng thời có thể làm mốc bị cũ
     -- (vd 103 -> follow nạn nhân 104 -> bùng 103: mốc cũ 103 sẽ không thấy tụt).
     before as (
       select s.user_id, max(s.following_count) as following_count
       from stat_snapshots s join partners p on p.pid = s.user_id
       where s.taken_at <= $3
         and s.taken_at >= coalesce(
           (select max(s2.taken_at) from stat_snapshots s2
            where s2.user_id = s.user_id and s2.taken_at <= $2::timestamptz - interval '1 minute'),
           '-infinity')
       group by s.user_id
     ),
     after as (
       select distinct on (s.user_id) s.user_id, s.following_count
       from stat_snapshots s join partners p on p.pid = s.user_id
       where s.taken_at > $3
       order by s.user_id, s.taken_at desc
     )
     select b.user_id as suspect_id, (b.following_count - a.following_count) as delta
     from before b join after a using (user_id)
     where a.following_count < b.following_count
     order by delta desc`,
    [ev.user_id, ev.window_start, ev.window_end],
  );

  for (const r of rows) {
    await pool.query(
      `insert into suspicions (drop_event_id, victim_id, suspect_id, following_delta)
       values ($1, $2, $3, $4) on conflict do nothing`,
      [ev.id, ev.user_id, r.suspect_id, r.delta],
    );
  }

  const { rows: sus } = await pool.query(
    `select id, suspect_id, following_delta from suspicions where drop_event_id = $1`,
    [ev.id],
  );
  const profiles = await getPublicProfiles(sus.map((s) => s.suspect_id));
  notify(ev.user_id, 'follower:drop', {
    dropEventId: ev.id,
    lost: ev.prev_count - ev.new_count,
    // mỗi nghi phạm kèm link profile: mở app TikTok, nút "Bạn bè" = còn follow, "Đang follow" = đã bỏ
    suspects: sus.map((s) => ({
      suspicionId: s.id,
      followingDelta: s.following_delta,
      user: profiles.get(s.suspect_id),
    })),
    note: sus.length === 0 ? 'Không xác định được người trong hệ thống — có thể do người ngoài hoặc TikTok dọn tài khoản ảo' : undefined,
  });
}

/** Lập lịch poll định kỳ: chỉ poll user có người follow qua hệ thống (mới có thứ để theo dõi) */
export async function schedulePolls(): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `select u.id from users u
     where u.status <> 'banned' and u.tracking_ok
       and u.last_seen_at > now() - interval '30 days'
       and exists (select 1 from follows f where f.followee_id = u.id and f.status = 'active')`,
  );
  const bucket = Math.floor(Date.now() / (config.poll.intervalMin * 60_000));
  for (let i = 0; i < rows.length; i += 500) {
    await pollQueue.addBulk(rows.slice(i, i + 500).map((r) => ({
      name: 'poll-user',
      data: { userId: r.id },
      // jobId theo chu kỳ -> scheduler có chạy trùng cũng không nhân đôi job
      opts: { jobId: `poll-${r.id}-${bucket}`, priority: 10 },
    })));
  }
  return rows.length;
}

/** Thưởng duy trì: follow còn active sau 7 / 30 ngày */
export async function retentionBonuses(): Promise<void> {
  for (const [days, col, reason] of [[7, 'bonus7', 'RETAIN_7D'], [30, 'bonus30', 'RETAIN_30D']] as const) {
    const { rows } = await pool.query<{ follower_id: number }>(
      `update follows set ${col} = true
       where status = 'active' and not ${col} and since < now() - make_interval(days => $1)
       returning follower_id`,
      [days],
    );
    for (const r of rows) {
      await tx((c) => applyTrust(c, r.follower_id, reason));
    }
  }
  // nghi vấn treo quá 7 ngày không ai xác nhận -> hết hạn
  await pool.query(
    `update suspicions set status = 'expired', resolved_at = now()
     where status = 'pending' and created_at < now() - interval '7 days'`,
  );
}
