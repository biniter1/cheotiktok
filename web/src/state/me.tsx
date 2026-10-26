import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { backend } from '../lib/backend';
import { ApiError } from '../lib/real';
import type { Me } from '../lib/types';

interface MeCtx {
  me: Me | null;
  loading: boolean;
  unauthorized: boolean;
  refresh: () => Promise<void>;
  alertCount: number;
  setAlertCount: (n: number) => void;
}

const Ctx = createContext<MeCtx | null>(null);

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setMe(await backend.me());
      setUnauthorized(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setUnauthorized(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    backend.suspicions().then((s) => setAlertCount(s.length)).catch(() => {});
    // cảnh báo tụt follow tới realtime -> tăng badge ngay
    const off1 = backend.zone.on('follower:drop', (d) => setAlertCount((n) => n + d.suspects.length));
    const off2 = backend.zone.on('trust:penalty', () => void refresh());
    return () => {
      off1();
      off2();
    };
  }, [refresh]);

  return (
    <Ctx.Provider value={{ me, loading, unauthorized, refresh, alertCount, setAlertCount }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMe(): MeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useMe outside MeProvider');
  return c;
}
