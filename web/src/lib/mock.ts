/**
 * Backend giả lập chạy hoàn toàn trong trình duyệt (VITE_MOCK=1).
 * Dùng để xem/duyệt giao diện mà không cần dựng server.
 */
import type { Backend, LedgerEntry, Me, PublicProfile, ServerEvents, Suspicion } from './types';

type Handler = (d: unknown) => void;
const handlers = new Map<string, Set<Handler>>();
const emit = <E extends keyof ServerEvents>(e: E, d: ServerEvents[E]) =>
  handlers.get(e)?.forEach((h) => h(d));

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const people: [string, string, number][] = [
  ['Ngọc Hân', 'hanreview.skincare', 74],
  ['Tuấn Kiệt', 'kiet.dothidaily', 58],
  ['Bảo Trâm', 'tram.ootd', 66],
  ['Minh Quân', 'quan.unbox', 81],
  ['Thảo Vy', 'vy.anvat', 47],
  ['Đức Huy', 'huy.giadung', 35],
  ['Khánh Linh', 'linh.mevabe', 63],
  ['Gia Bảo', 'giabao.tech', 52],
];

const tierOf = (s: number) => (s < 40 ? 'low' : s < 70 ? 'mid' : 'high') as PublicProfile['tier'];
const profile = (i: number): PublicProfile => {
  const [name, user, score] = people[i % people.length];
  return {
    id: 100 + i,
    displayName: name,
    username: user,
    avatarUrl: null,
    profileUrl: `https://www.tiktok.com/@${user}`,
    trustScore: score,
    tier: tierOf(score),
    warning: score < 30,
  };
};

let me: Me = {
  id: 1,
  displayName: 'Bin',
  username: 'bin.aff',
  avatarUrl: null,
  profileUrl: 'https://www.tiktok.com/@bin.aff',
  trustScore: 62,
  tier: 'mid',
  warning: false,
  status: 'active',
  bannedUntil: null,
  trackingOk: true,
  stats: { followerCount: 846, followingCount: 912, followerDelta7d: 37, statsTakenAt: ago(9) },
};

const ledger: LedgerEntry[] = [
  { delta: 1, reason: 'MATCH_OK', ref_id: 812, created_at: ago(18) },
  { delta: 1, reason: 'MATCH_OK', ref_id: 809, created_at: ago(26) },
  { delta: 2, reason: 'RETAIN_7D', ref_id: null, created_at: ago(60 * 9) },
  { delta: -2, reason: 'NO_FOLLOW', ref_id: 640, created_at: ago(60 * 30) },
  { delta: 1, reason: 'MATCH_OK', ref_id: 611, created_at: ago(60 * 31) },
  { delta: 5, reason: 'RETAIN_30D', ref_id: null, created_at: ago(60 * 24 * 3) },
];

let suspicions: Suspicion[] = [
  { id: 41, suspect_id: 105, following_delta: 1, created_at: ago(7), lost: 2, suspect: profile(5) },
  { id: 42, suspect_id: 104, following_delta: 3, created_at: ago(7), lost: 2, suspect: profile(4) },
];

let matchSeq = 900;
let cursor = 0;
let active: { matchId: number; partner: PublicProfile; iConfirmed: boolean; partnerConfirmed: boolean; partnerFollows: boolean } | null = null;
let queued = false;

function addLedger(delta: number, reason: string, ref: number | null) {
  ledger.unshift({ delta, reason, ref_id: ref, created_at: new Date().toISOString() });
  const s = Math.max(0, Math.min(100, me.trustScore + delta));
  me = { ...me, trustScore: s, tier: tierOf(s), warning: s < 30 };
}

async function resolve() {
  if (!active) return;
  const m = active;
  active = null;
  await wait(1400);
  const youFollowed = m.iConfirmed;
  const status = youFollowed && m.partnerFollows ? 'ok' : youFollowed || m.partnerFollows ? 'partial' : 'expired';
  if (status === 'ok') addLedger(1, 'MATCH_OK', m.matchId);
  emit('match:result', {
    matchId: m.matchId,
    status,
    youFollowed,
    youConfirmed: m.iConfirmed,
    partnerFollowed: m.partnerFollows,
    hint: youFollowed && !m.partnerFollows ? 'PARTNER_DID_NOT_FOLLOW_BACK' : undefined,
  });
}

export const mockBackend: Backend = {
  loginUrl: '#/zone',
  me: async () => (await wait(200), { ...me }),
  ledger: async () => (await wait(200), [...ledger]),
  suspicions: async () => (await wait(250), [...suspicions]),
  confirmSuspicion: async (id) => {
    await wait(400);
    suspicions = suspicions.filter((s) => s.id !== id);
  },
  dismissSuspicion: async (id) => {
    await wait(300);
    suspicions = suspicions.filter((s) => s.id !== id);
  },
  logout: async () => {},
  deleteAccount: async () => {},
  fakeFollow: async () => {},
  zone: {
    connect() {},
    disconnect() {},
    async join() {
      if (active) return { ok: true, status: 'busy', state: `matched:${active.matchId}` };
      queued = true;
      const t = rand(1200, 3200);
      setTimeout(() => {
        if (!queued) return;
        queued = false;
        const partner = profile(cursor++);
        active = {
          matchId: ++matchSeq,
          partner,
          iConfirmed: false,
          partnerConfirmed: false,
          partnerFollows: Math.random() > 0.18,
        };
        const m = active;
        emit('match:found', { matchId: m.matchId, partner, timeoutSec: 90 });
        if (m.partnerFollows) {
          setTimeout(() => {
            if (active !== m) return;
            m.partnerConfirmed = true;
            emit('match:partner_confirmed', { matchId: m.matchId });
            if (m.iConfirmed) void resolve();
          }, rand(3500, 8000));
        }
        // đối phương không làm gì -> hết giờ
        setTimeout(() => active === m && void resolve(), 90_000);
      }, t);
      return { ok: true, status: 'queued', tier: me.tier };
    },
    async leave() {
      queued = false;
    },
    async confirm(matchId) {
      await wait(250);
      if (!active || active.matchId !== matchId) return { ok: false, error: 'MATCH_NOT_PENDING' };
      active.iConfirmed = true;
      if (active.partnerConfirmed || !active.partnerFollows) {
        // đối phương không follow: hệ thống chờ hết hạn; giả lập rút ngắn còn vài giây
        const m = active;
        setTimeout(() => active === m && void resolve(), m.partnerConfirmed ? 0 : 6000);
      }
      return { ok: true };
    },
    on(event, cb) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(cb as Handler);
      return () => void handlers.get(event)!.delete(cb as Handler);
    },
    onReconnect: () => () => {},
  },
};

export const mockOnlineCount = () => 140 + Math.round(rand(-12, 18));
