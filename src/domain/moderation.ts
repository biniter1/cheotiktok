import { pool, tx } from '../lib/db.js';
import { AppError } from '../lib/errors.js';
import { notify } from '../lib/notify.js';
import { applyTrust } from './trust.js';

/** LỚP 3 — nạn nhân xác nhận nghi phạm đã unfollow (đã kiểm tra trên app TikTok) */
export async function confirmSuspicion(victimId: number, suspicionId: number): Promise<void> {
  const suspectId = await tx(async (c) => {
    const { rows } = await c.query(
      `update suspicions set status = 'confirmed', resolved_at = now()
       where id = $1 and victim_id = $2 and status = 'pending'
       returning suspect_id`,
      [suspicionId, victimId],
    );
    if (!rows[0]) throw new AppError('SUSPICION_NOT_PENDING', 409);
    const suspect: number = rows[0].suspect_id;

    await c.query(
      `update follows set status = 'broken', broken_at = now()
       where follower_id = $1 and followee_id = $2`,
      [suspect, victimId],
    );
    const { rows: rep } = await c.query('select trust_score from users where id = $1', [victimId]);
    await c.query(
      `insert into reports (reporter_id, target_id, suspicion_id, weight, status)
       values ($1, $2, $3, $4, 'upheld')`,
      [victimId, suspect, suspicionId, rep[0].trust_score / 100],
    );
    await applyTrust(c, suspect, 'UNFOLLOW_CONFIRMED', suspicionId);
    return suspect;
  });
  notify(suspectId, 'trust:penalty', { reason: 'UNFOLLOW_CONFIRMED', suspicionId, canAppeal: true });
}

export async function dismissSuspicion(victimId: number, suspicionId: number): Promise<void> {
  const { rowCount } = await pool.query(
    `update suspicions set status = 'dismissed', resolved_at = now()
     where id = $1 and victim_id = $2 and status = 'pending'`,
    [suspicionId, victimId],
  );
  if (!rowCount) throw new AppError('SUSPICION_NOT_PENDING', 409);
}

/**
 * Report tay (không có bằng chứng đối chiếu): KHÔNG trừ điểm, chỉ tích luỹ.
 * Trọng số = điểm tin cậy người report / 100 -> người uy tín thấp report bừa không ảnh hưởng mấy.
 * Tổng trọng số >= 3 trong 30 ngày -> bật cảnh báo.
 */
const MANUAL_REPORT_WARNING_WEIGHT = 3;

export async function manualReport(reporterId: number, targetId: number, note: string | undefined): Promise<void> {
  if (reporterId === targetId) throw new AppError('CANNOT_REPORT_SELF');
  await tx(async (c) => {
    // chỉ được report người từng ghép với mình
    const { rows: rel } = await c.query(
      `select 1 from matches where (user_a = $1 and user_b = $2) or (user_a = $2 and user_b = $1) limit 1`,
      [reporterId, targetId],
    );
    if (!rel[0]) throw new AppError('NO_RELATIONSHIP', 403);
    const { rows: dup } = await c.query(
      `select 1 from reports where reporter_id = $1 and target_id = $2 and suspicion_id is null
       and created_at > now() - interval '30 days'`,
      [reporterId, targetId],
    );
    if (dup[0]) throw new AppError('ALREADY_REPORTED', 409);

    const { rows: me } = await c.query('select trust_score from users where id = $1', [reporterId]);
    await c.query(
      `insert into reports (reporter_id, target_id, note, weight) values ($1, $2, $3, $4)`,
      [reporterId, targetId, note?.slice(0, 500) ?? null, me[0].trust_score / 100],
    );
    const { rows: sum } = await c.query(
      `select coalesce(sum(weight), 0)::float w from reports
       where target_id = $1 and suspicion_id is null and status = 'open'
       and created_at > now() - interval '30 days'`,
      [targetId],
    );
    if (sum[0].w >= MANUAL_REPORT_WARNING_WEIGHT) {
      await c.query('update users set warning = true where id = $1', [targetId]);
    }
  });
}

export async function createAppeal(userId: number, suspicionId: number, note?: string, evidenceUrl?: string): Promise<number> {
  const { rows: s } = await pool.query(
    `select 1 from suspicions where id = $1 and suspect_id = $2 and status = 'confirmed'`,
    [suspicionId, userId],
  );
  if (!s[0]) throw new AppError('NOTHING_TO_APPEAL', 404);
  const { rows } = await pool.query(
    `insert into appeals (user_id, suspicion_id, note, evidence_url) values ($1, $2, $3, $4)
     on conflict (suspicion_id) do nothing returning id`,
    [userId, suspicionId, note?.slice(0, 1000) ?? null, evidenceUrl ?? null],
  );
  if (!rows[0]) throw new AppError('ALREADY_APPEALED', 409);
  return rows[0].id;
}

/** Admin duyệt kháng cáo. Chấp nhận => hoàn điểm cho người bị phạt, phạt người xác nhận sai. */
export async function resolveAppeal(adminId: number, appealId: number, accept: boolean): Promise<void> {
  const result = await tx(async (c) => {
    const { rows } = await c.query(
      `update appeals set status = $3, resolved_by = $2, resolved_at = now()
       where id = $1 and status = 'open' returning user_id, suspicion_id`,
      [appealId, adminId, accept ? 'accepted' : 'rejected'],
    );
    const a = rows[0];
    if (!a) throw new AppError('APPEAL_NOT_OPEN', 409);
    if (!accept) return { suspect: a.user_id as number, victim: null };

    const { rows: s } = await c.query(
      `update suspicions set status = 'overturned' where id = $1 returning victim_id, suspect_id`,
      [a.suspicion_id],
    );
    const victim: number = s[0].victim_id;
    const suspect: number = s[0].suspect_id;
    await c.query(`update reports set status = 'rejected' where suspicion_id = $1`, [a.suspicion_id]);
    await c.query(
      `update follows set status = 'active', broken_at = null where follower_id = $1 and followee_id = $2`,
      [suspect, victim],
    );
    await applyTrust(c, suspect, 'APPEAL_REFUND', appealId);
    await applyTrust(c, victim, 'FALSE_REPORT', appealId);
    // gỡ khoá tạm nếu án phạt bị lật và điểm đã đủ
    await c.query(
      `update users set status = 'active', banned_until = null
       where id = $1 and status = 'suspended' and trust_score >= 10`,
      [suspect],
    );
    return { suspect, victim };
  });
  notify(result.suspect, 'appeal:resolved', { appealId, accepted: accept });
  if (result.victim) notify(result.victim, 'trust:penalty', { reason: 'FALSE_REPORT', appealId });
}
