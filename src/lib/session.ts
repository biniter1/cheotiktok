import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const TTL_SEC = 7 * 24 * 3600;
export const SESSION_COOKIE = 'sid';
export const SESSION_MAX_AGE = TTL_SEC;

export function signSession(userId: number): string {
  return jwt.sign({ uid: userId }, config.jwtSecret, { expiresIn: TTL_SEC });
}

export function verifySession(token: string | undefined): number | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, config.jwtSecret) as { uid?: number };
    return typeof p.uid === 'number' ? p.uid : null;
  } catch {
    return null;
  }
}
