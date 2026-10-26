import crypto from 'node:crypto';
import { config } from '../config.js';

const key = Buffer.from(config.tokenEncKey, 'base64');
if (key.length !== 32) throw new Error('TOKEN_ENC_KEY must decode to 32 bytes (openssl rand -base64 32)');

/** AES-256-GCM: iv(12) | tag(16) | ciphertext, base64 */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}

export function decrypt(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}
