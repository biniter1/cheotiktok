/**
 * Load test (chế độ TIKTOK_MOCK=1).
 *   USERS=200 MATCHES_PER_USER=5 FOLLOW_RATE=0.9 BASE_URLS=http://localhost:3001,http://localhost:3002 node dist/scripts/loadtest.js
 *
 * Pha 1: N user đăng nhập, rải đều qua các instance API, vào hàng chờ, ghép, follow, xác nhận.
 * Pha 2: một số user "bùng" (unfollow sau khi đã ghép OK) -> chờ hệ thống báo cho nạn nhân,
 *        nạn nhân xác nhận -> kiểm tra kẻ bùng bị trừ điểm.
 */
import { io, type Socket } from 'socket.io-client';

const BASE_URLS = (process.env.BASE_URLS ?? 'http://localhost:3000').split(',');
const USERS = Number(process.env.USERS ?? 200);
const MATCHES_PER_USER = Number(process.env.MATCHES_PER_USER ?? 5);
const FOLLOW_RATE = Number(process.env.FOLLOW_RATE ?? 0.9);
const UNFOLLOWERS = Number(process.env.UNFOLLOWERS ?? 10);
const PHASE2_TIMEOUT_MS = Number(process.env.PHASE2_TIMEOUT_MS ?? 120_000);
const RUN_ID = Date.now().toString(36);

interface VUser {
  idx: number;
  base: string;
  userId: number;
  cookie: string;
  socket: Socket;
  done: number;
  okPartners: number[];
  joinedAt: number;
  pendingConfirmAt?: number;
}

const stats = {
  results: { ok: 0, partial: 0, failed: 0, expired: 0 } as Record<string, number>,
  matchLatency: [] as number[],
  verifyLatency: [] as number[],
  errors: 0,
  httpErrors: 0,
  drops: 0,
  suspectsFound: 0,
  confirmed: 0,
  reconnects: 0,
};

const pct = (arr: number[], p: number) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

async function http(u: Pick<VUser, 'base' | 'cookie'>, method: string, path: string, body?: unknown) {
  const res = await fetch(`${u.base}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json', cookie: u.cookie } : { cookie: u.cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    stats.httpErrors++;
    throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<any>;
}

async function login(idx: number): Promise<Omit<VUser, 'socket'>> {
  const base = BASE_URLS[idx % BASE_URLS.length];
  const res = await fetch(`${base}/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ openId: `lt_${RUN_ID}_${idx}` }),
  });
  if (!res.ok) throw new Error(`login ${idx}: ${res.status} ${await res.text()}`);
  const { userId } = (await res.json()) as { userId: number };
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
  return { idx, base, userId, cookie, done: 0, okPartners: [], joinedAt: 0 };
}

function join(u: VUser) {
  u.joinedAt = Date.now();
  u.socket.emit('queue:join', (r: any) => {
    if (!r?.ok) {
      stats.errors++;
      setTimeout(() => join(u), 500);
    } else if (r.status === 'busy' && r.state === 'pairing') {
      // pod đang ghép cho mình vừa chết giữa chừng: trạng thái 'pairing' tự hết hạn -> thử lại
      setTimeout(() => join(u), 2000);
    }
  });
}

async function main() {
  console.log(`== Pha 1: ${USERS} user, ${BASE_URLS.length} instance API, ${MATCHES_PER_USER} lượt/user ==`);
  const t0 = Date.now();

  const logged = await Promise.all(Array.from({ length: USERS }, (_, i) => login(i)));
  console.log(`đăng nhập xong ${logged.length} user trong ${Date.now() - t0}ms`);

  const users: VUser[] = [];
  let finished = 0;
  let resolvePhase1!: () => void;
  const phase1 = new Promise<void>((r) => (resolvePhase1 = r));

  for (const l of logged) {
    const socket = io(l.base, { transports: ['websocket'], extraHeaders: { cookie: l.cookie }, reconnection: true });
    const u: VUser = { ...l, socket };
    users.push(u);
    const hb = setInterval(() => socket.emit('heartbeat'), 10_000);
    socket.on('disconnect', () => clearInterval(hb));

    socket.on('match:found', async ({ matchId, partner }: any) => {
      stats.matchLatency.push(Date.now() - u.joinedAt);
      (u as any).currentPartner = partner.id;
      try {
        if (Math.random() < FOLLOW_RATE) {
          await http(u, 'POST', '/dev/mock-follow', { targetUserId: partner.id, dir: 1 });
          u.pendingConfirmAt = Date.now();
          socket.emit('match:confirm', { matchId }, (r: any) => { if (!r?.ok) stats.errors++; });
        } // không follow, không xác nhận -> để timeout xử lý
      } catch {
        stats.errors++;
      }
    });

    socket.on('match:result', ({ status, partnerFollowed, youFollowed }: any) => {
      stats.results[status] = (stats.results[status] ?? 0) + 1;
      if (u.pendingConfirmAt) stats.verifyLatency.push(Date.now() - u.pendingConfirmAt);
      u.pendingConfirmAt = undefined;
      if (status === 'ok' && partnerFollowed && youFollowed) u.okPartners.push((u as any).currentPartner);
      u.done++;
      if (u.done >= MATCHES_PER_USER) {
        if (u.done === MATCHES_PER_USER && ++finished === USERS) resolvePhase1();
        socket.emit('queue:leave');
      } else {
        join(u);
      }
    });

    socket.on('match:error', () => setTimeout(() => join(u), 300));
    // pod chết -> client tự nối lại (LB đẩy sang pod khác) -> vào lại hàng chờ như frontend thật
    socket.io.on('reconnect', () => {
      stats.reconnects++;
      if (u.done < MATCHES_PER_USER) join(u);
    });
    socket.on('follower:drop', (d: any) => {
      stats.drops++;
      stats.suspectsFound += d.suspects.length;
      (u as any).lastDrop = d;
    });
  }

  await Promise.all(users.map((u) => new Promise<void>((r) => (u.socket.connected ? r() : u.socket.once('connect', () => r())))));
  users.forEach(join);

  // user cuối có thể không còn ai để ghép (đã gặp hết) -> dừng khi đứng yên 15s
  let last = -1;
  let idleSince = Date.now();
  await Promise.race([
    phase1,
    new Promise<void>((r) => {
      const t = setInterval(() => {
        const total = Object.values(stats.results).reduce((a, b) => a + b, 0);
        if (total !== last) { last = total; idleSince = Date.now(); }
        if (Date.now() - idleSince > 15_000) { clearInterval(t); r(); }
      }, 1000);
    }),
  ]);

  const dur = (Date.now() - t0) / 1000;
  const totalResults = Object.values(stats.results).reduce((a, b) => a + b, 0);
  console.log(`\nPha 1 xong trong ${dur.toFixed(1)}s`);
  console.log(`  kết quả match (mỗi match đếm 2 phía):`, stats.results, `tổng ${totalResults}`);
  console.log(`  thời gian chờ ghép  p50=${pct(stats.matchLatency, 50)}ms p95=${pct(stats.matchLatency, 95)}ms p99=${pct(stats.matchLatency, 99)}ms`);
  console.log(`  xác nhận -> kết quả p50=${pct(stats.verifyLatency, 50)}ms p95=${pct(stats.verifyLatency, 95)}ms`);
  console.log(`  lỗi socket=${stats.errors} lỗi http=${stats.httpErrors} tự nối lại=${stats.reconnects}`);
  const stuck = users.filter((u) => u.done < MATCHES_PER_USER).length;
  console.log(`  user chưa đủ lượt (hết người mới để ghép hoặc bị kẹt): ${stuck}`);

  // ---------------- Pha 2: giả lập bùng follow ----------------
  console.log(`\n== Pha 2: ${UNFOLLOWERS} user bùng follow ==`);
  const victims: { victim: VUser; cheater: VUser }[] = [];
  const byId = new Map(users.map((u) => [u.userId, u]));
  // mỗi kẻ bùng chọn 1 đối phương đã follow nhau OK; mỗi người chỉ đóng 1 vai
  const used = new Set<number>();
  for (const cheater of users) {
    if (victims.length >= UNFOLLOWERS) break;
    if (used.has(cheater.userId)) continue;
    const victimId = cheater.okPartners.find((p) => !used.has(p));
    const victim = victimId !== undefined ? byId.get(victimId) : undefined;
    if (!victim) continue;
    used.add(cheater.userId).add(victim.userId);
    victims.push({ victim, cheater });
  }
  if (victims.length === 0) {
    console.log('  (không có cặp follow OK nào để thử)');
  } else {
    const before = new Map<number, number>();
    for (const { cheater } of victims) before.set(cheater.userId, (await http(cheater, 'GET', '/me')).trustScore);
    for (const { cheater, victim } of victims) {
      await http(cheater, 'POST', '/dev/mock-follow', { targetUserId: victim.userId, dir: -1 });
    }
    console.log('  đã bùng, chờ worker phát hiện + đối chiếu...');
    const t1 = Date.now();
    await new Promise<void>((resolve) => {
      const t = setInterval(() => {
        const got = victims.filter(({ victim }) => (victim as any).lastDrop).length;
        if (got === victims.length || Date.now() - t1 > PHASE2_TIMEOUT_MS) { clearInterval(t); resolve(); }
      }, 1000);
    });
    let caught = 0;
    for (const { victim, cheater } of victims) {
      const d = (victim as any).lastDrop;
      const hit = d?.suspects.find((s: any) => s.user?.id === cheater.userId);
      if (hit) {
        caught++;
        await http(victim, 'POST', `/suspicions/${hit.suspicionId}/confirm`);
        stats.confirmed++;
      }
    }
    console.log(`  nạn nhân nhận cảnh báo: ${victims.filter(({ victim }) => (victim as any).lastDrop).length}/${victims.length} sau ${((Date.now() - t1) / 1000).toFixed(1)}s`);
    console.log(`  truy đúng kẻ bùng: ${caught}/${victims.length}`);
    for (const { cheater } of victims) {
      const after = (await http(cheater, 'GET', '/me')).trustScore;
      console.log(`  user ${cheater.userId}: điểm ${before.get(cheater.userId)} -> ${after}`);
    }
  }

  users.forEach((u) => u.socket.close());
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
