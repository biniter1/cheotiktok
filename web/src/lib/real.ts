import { io, type Socket } from 'socket.io-client';
import type { Backend, JoinAck, ServerEvents } from './types';

const API = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'NETWORK', res.status);
  return data as T;
}

let socket: Socket | null = null;
let heartbeat: ReturnType<typeof setInterval> | undefined;

function getSocket(): Socket {
  if (!socket) {
    // chỉ websocket: backend chạy nhiều bản không cần sticky session
    socket = io(API || undefined, { transports: ['websocket'], withCredentials: true, autoConnect: false });
  }
  return socket;
}

function emitAck<T>(event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve) => {
    getSocket().timeout(10_000).emit(event, ...args, (err: Error | null, res: T) => {
      resolve(err ? ({ ok: false, error: 'TIMEOUT' } as T) : res);
    });
  });
}

export const realBackend: Backend = {
  loginUrl: `${API}/auth/tiktok`,
  me: () => call('GET', '/me'),
  ledger: () => call('GET', '/me/ledger'),
  suspicions: () => call('GET', '/me/suspicions'),
  confirmSuspicion: async (id) => void (await call('POST', `/suspicions/${id}/confirm`)),
  dismissSuspicion: async (id) => void (await call('POST', `/suspicions/${id}/dismiss`)),
  logout: async () => void (await call('POST', '/auth/logout')),
  zone: {
    connect() {
      const s = getSocket();
      if (!s.connected) s.connect();
      clearInterval(heartbeat);
      heartbeat = setInterval(() => s.connected && s.emit('heartbeat'), 10_000);
    },
    disconnect() {
      clearInterval(heartbeat);
      socket?.disconnect();
    },
    join: () => emitAck<JoinAck>('queue:join'),
    leave: async () => void (await emitAck('queue:leave')),
    confirm: (matchId) => emitAck('match:confirm', { matchId }),
    on<E extends keyof ServerEvents>(event: E, cb: (d: ServerEvents[E]) => void) {
      const s = getSocket();
      const h = cb as (...a: unknown[]) => void;
      s.on(event as string, h);
      return () => void s.off(event as string, h);
    },
    onReconnect(cb) {
      const m = getSocket().io;
      m.on('reconnect', cb);
      return () => void m.off('reconnect', cb);
    },
  },
};
