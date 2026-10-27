import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { pool } from '../lib/db.js';
import { AppError } from '../lib/errors.js';
import { confirmSuspicion, createAppeal, dismissSuspicion, manualReport, resolveAppeal } from '../domain/moderation.js';
import { getPublicProfiles, getUser, toPublic } from '../domain/users.js';
import { deleteAccount, followerStats } from '../domain/account.js';
import { SESSION_COOKIE } from '../lib/session.js';
import { mockFollow } from '../tiktok/client.js';
import { authenticate } from './auth.js';

const idParam = (req: FastifyRequest) => {
  const id = Number((req.params as { id: string }).id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new AppError('BAD_ID');
  return id;
};

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const u = await getUser(req.uid);
  if (u.role !== 'admin') await reply.code(403).send({ error: 'FORBIDDEN' });
}

export function registerApi(app: FastifyInstance): void {
  app.register(async (r) => {
    r.addHook('preHandler', authenticate);

    r.get('/me', async (req) => {
      const u = await getUser(req.uid);
      if (u.open_id.startsWith('deleted_')) throw new AppError('UNAUTHORIZED', 401);
      return {
        ...toPublic(u),
        status: u.status,
        bannedUntil: u.banned_until,
        trackingOk: u.tracking_ok,
        stats: await followerStats(req.uid),
      };
    });

    // Người dùng tự xoá tài khoản và dữ liệu (cam kết trong Privacy Policy)
    r.post('/me/delete', async (req, reply) => {
      await deleteAccount(req.uid);
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      return { ok: true };
    });

    r.get('/me/ledger', async (req) => {
      const { rows } = await pool.query(
        `select delta, reason, ref_id, created_at from trust_ledger
         where user_id = $1 order by created_at desc limit 100`,
        [req.uid],
      );
      return rows;
    });

    // Danh sách nghi phạm đang chờ mình xác nhận
    r.get('/me/suspicions', async (req) => {
      const { rows } = await pool.query(
        `select s.id, s.suspect_id, s.following_delta, s.created_at, d.prev_count - d.new_count as lost
         from suspicions s join drop_events d on d.id = s.drop_event_id
         where s.victim_id = $1 and s.status = 'pending' order by s.created_at desc`,
        [req.uid],
      );
      const profiles = await getPublicProfiles(rows.map((x) => x.suspect_id));
      return rows.map((x) => ({ ...x, suspect: profiles.get(x.suspect_id) }));
    });

    r.post('/suspicions/:id/confirm', async (req) => {
      await confirmSuspicion(req.uid, idParam(req));
      return { ok: true };
    });

    r.post('/suspicions/:id/dismiss', async (req) => {
      await dismissSuspicion(req.uid, idParam(req));
      return { ok: true };
    });

    r.post('/reports', async (req) => {
      const { targetId, note } = (req.body ?? {}) as { targetId?: number; note?: string };
      if (!Number.isSafeInteger(targetId)) throw new AppError('BAD_TARGET');
      await manualReport(req.uid, targetId!, note);
      return { ok: true };
    });

    r.post('/appeals', async (req) => {
      const { suspicionId, note, evidenceUrl } = (req.body ?? {}) as { suspicionId?: number; note?: string; evidenceUrl?: string };
      if (!Number.isSafeInteger(suspicionId)) throw new AppError('BAD_SUSPICION');
      if (evidenceUrl && !/^https:\/\//.test(evidenceUrl)) throw new AppError('BAD_EVIDENCE_URL');
      return { appealId: await createAppeal(req.uid, suspicionId!, note, evidenceUrl) };
    });

    r.get('/users/:id', async (req) => {
      const p = (await getPublicProfiles([idParam(req)])).values().next().value;
      if (!p) throw new AppError('USER_NOT_FOUND', 404);
      return p;
    });

    // --- admin ---
    r.get('/admin/appeals', { preHandler: requireAdmin }, async () => {
      const { rows } = await pool.query(
        `select a.*, s.victim_id, s.suspect_id, s.following_delta
         from appeals a join suspicions s on s.id = a.suspicion_id
         where a.status = 'open' order by a.created_at`,
      );
      return rows;
    });

    r.post('/admin/appeals/:id/resolve', { preHandler: requireAdmin }, async (req) => {
      const { accept } = (req.body ?? {}) as { accept?: boolean };
      await resolveAppeal(req.uid, idParam(req), accept === true);
      return { ok: true };
    });

    // --- giả lập follow/unfollow (chỉ chế độ mock) ---
    if (config.tiktokMock) {
      r.post('/dev/mock-follow', async (req) => {
        const { targetUserId, dir } = (req.body ?? {}) as { targetUserId?: number; dir?: 1 | -1 };
        const { rows } = await pool.query(
          'select id, open_id from users where id = any($1::bigint[])',
          [[req.uid, targetUserId]],
        );
        const me = rows.find((x) => x.id === req.uid);
        const target = rows.find((x) => x.id === targetUserId);
        if (!me || !target) throw new AppError('USER_NOT_FOUND', 404);
        await mockFollow(me.open_id, target.open_id, dir === -1 ? -1 : 1);
        return { ok: true };
      });
    }
  });
}
