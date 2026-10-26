import { useCallback, useEffect, useRef, useState } from 'react';
import { backend } from '../lib/backend';
import type { MatchFound, MatchResult, PublicProfile } from '../lib/types';

export type Phase =
  | { k: 'idle' }
  | { k: 'queued' }
  | {
      k: 'matched';
      match: MatchFound;
      deadline: number;
      opened: boolean;
      iConfirmed: boolean;
      partnerConfirmed: boolean;
      confirming: boolean;
    }
  | { k: 'result'; partner: PublicProfile; result: MatchResult }
  | { k: 'error'; code: string };

const AUTO_NEXT_MS = 3200;

/**
 * Máy trạng thái của zone: idle -> queued -> matched -> result -> (tự ghép tiếp) queued ...
 * Mọi event đến từ server đều được đối chiếu matchId để bỏ qua event cũ.
 */
export function useZone(onDone?: () => void) {
  const [phase, setPhase] = useState<Phase>({ k: 'idle' });
  const [autoNext, setAutoNext] = useState(true);
  const [okCount, setOkCount] = useState(0);
  const phaseRef = useRef(phase);
  const wantInZone = useRef(false);
  const autoRef = useRef(autoNext);
  const nextTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  phaseRef.current = phase;
  autoRef.current = autoNext;

  const join = useCallback(async () => {
    clearTimeout(nextTimer.current);
    wantInZone.current = true;
    setPhase({ k: 'queued' });
    const ack = await backend.zone.join();
    if (!ack.ok) {
      wantInZone.current = false;
      setPhase({ k: 'error', code: ack.error });
    } else if (ack.status === 'busy' && ack.state === 'pairing') {
      // máy chủ đang ghép dở cho mình (vd vừa đổi máy chủ): thử lại
      nextTimer.current = setTimeout(() => wantInZone.current && void join(), 2000);
    }
  }, []);

  const leave = useCallback(async () => {
    clearTimeout(nextTimer.current);
    wantInZone.current = false;
    setPhase({ k: 'idle' });
    await backend.zone.leave();
  }, []);

  const markOpened = useCallback(() => {
    setPhase((p) => (p.k === 'matched' ? { ...p, opened: true } : p));
  }, []);

  const confirm = useCallback(async () => {
    const p = phaseRef.current;
    if (p.k !== 'matched' || p.iConfirmed) return;
    setPhase({ ...p, confirming: true });
    const r = await backend.zone.confirm(p.match.matchId);
    setPhase((cur) =>
      cur.k === 'matched' && cur.match.matchId === p.match.matchId
        ? { ...cur, confirming: false, iConfirmed: r.ok }
        : cur,
    );
  }, []);

  useEffect(() => {
    backend.zone.connect();
    const offs = [
      backend.zone.on('match:found', (m) => {
        clearTimeout(nextTimer.current);
        setPhase({
          k: 'matched',
          match: m,
          deadline: Date.now() + m.timeoutSec * 1000,
          opened: false,
          iConfirmed: false,
          partnerConfirmed: false,
          confirming: false,
        });
      }),
      backend.zone.on('match:partner_confirmed', ({ matchId }) => {
        setPhase((p) => (p.k === 'matched' && p.match.matchId === matchId ? { ...p, partnerConfirmed: true } : p));
      }),
      backend.zone.on('match:result', (r: MatchResult) => {
        const p = phaseRef.current;
        if (p.k !== 'matched' || p.match.matchId !== r.matchId) return;
        setPhase({ k: 'result', partner: p.match.partner, result: r });
        if (r.status === 'ok') setOkCount((n) => n + 1);
        onDone?.();
        if (autoRef.current && wantInZone.current) {
          nextTimer.current = setTimeout(() => void join(), AUTO_NEXT_MS);
        }
      }),
      backend.zone.on('match:error', () => {
        if (wantInZone.current) nextTimer.current = setTimeout(() => void join(), 600);
      }),
      // mất kết nối rồi nối lại (có thể sang máy chủ khác): vào lại hàng chờ
      backend.zone.onReconnect(() => {
        if (wantInZone.current && phaseRef.current.k === 'queued') void join();
      }),
    ];
    return () => {
      offs.forEach((off) => off());
      clearTimeout(nextTimer.current);
      if (wantInZone.current) void backend.zone.leave();
    };
  }, [join, onDone]);

  return { phase, join, leave, confirm, markOpened, autoNext, setAutoNext, okCount };
}
