export type Tier = 'low' | 'mid' | 'high';

export interface PublicProfile {
  id: number;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  trustScore: number;
  tier: Tier;
  warning: boolean;
}

export interface FollowerStats {
  followerCount: number;
  followingCount: number;
  followerDelta7d: number;
  statsTakenAt: string;
}

export interface Me extends PublicProfile {
  status: 'active' | 'suspended' | 'banned';
  bannedUntil: string | null;
  trackingOk: boolean;
  stats: FollowerStats | null;
}

export interface LedgerEntry {
  delta: number;
  reason: string;
  ref_id: number | null;
  created_at: string;
}

export interface Suspicion {
  id: number;
  suspect_id: number;
  following_delta: number;
  created_at: string;
  lost: number;
  suspect?: PublicProfile;
}

export type MatchStatus = 'ok' | 'partial' | 'failed' | 'expired';

export interface MatchFound {
  matchId: number;
  partner: PublicProfile;
  timeoutSec: number;
}

export interface MatchResult {
  matchId: number;
  status: MatchStatus;
  youFollowed: boolean;
  /** mình đã bấm "Mình đã follow" (dùng để báo đúng mức trừ điểm) */
  youConfirmed?: boolean;
  partnerFollowed: boolean;
  hint?: string;
}

export interface FollowerDrop {
  dropEventId: number;
  lost: number;
  suspects: { suspicionId: number; followingDelta: number; user?: PublicProfile }[];
  note?: string;
}

export type JoinAck =
  | { ok: true; status: 'queued'; tier: Tier }
  | { ok: true; status: 'matched'; matchId: number }
  | { ok: true; status: 'busy'; state: string }
  | { ok: false; error: string };

export interface ServerEvents {
  'match:found': MatchFound;
  'match:partner_confirmed': { matchId: number };
  'match:result': MatchResult;
  'match:error': { retry: boolean };
  'follower:drop': FollowerDrop;
  'trust:penalty': { reason: string };
  'appeal:resolved': { appealId: number; accepted: boolean };
}

export interface Backend {
  me(): Promise<Me>;
  ledger(): Promise<LedgerEntry[]>;
  suspicions(): Promise<Suspicion[]>;
  confirmSuspicion(id: number): Promise<void>;
  dismissSuspicion(id: number): Promise<void>;
  logout(): Promise<void>;
  deleteAccount(): Promise<void>;
  loginUrl: string;
  /** Chỉ dùng trên server chạy thử: giả lập hành động bấm Follow trên TikTok */
  fakeFollow(targetUserId: number): Promise<void>;
  zone: {
    connect(): void;
    disconnect(): void;
    join(): Promise<JoinAck>;
    leave(): Promise<void>;
    confirm(matchId: number): Promise<{ ok: boolean; error?: string }>;
    on<E extends keyof ServerEvents>(event: E, cb: (data: ServerEvents[E]) => void): () => void;
    onReconnect(cb: () => void): () => void;
  };
}
