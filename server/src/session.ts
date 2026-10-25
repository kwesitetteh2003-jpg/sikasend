import { createHmac, timingSafeEqual } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { SessionState } from './app.js';

/**
 * Signed, client-held demo session for the hosted (serverless) demo.
 *
 * Serverless instances share no memory, so instead of a database each browser carries its own demo
 * state (quotes, transfers, ledger chain) as an opaque token: gzip(JSON) + HMAC-SHA256. The server
 * rejects any token whose signature does not match, so a visitor cannot edit a quote's price, a
 * transfer's status or their policy history; the worst they can do is drop the token and start fresh.
 * The key comes from SIKASEND_SESSION_SECRET (set in the hosting env, never committed).
 */
const b64u = (b: Buffer) => b.toString('base64url');

export function sign(state: SessionState, secret: string): string {
  const body = b64u(gzipSync(Buffer.from(JSON.stringify(state))));
  return `${body}.${b64u(createHmac('sha256', secret).update(body).digest())}`;
}

export function verify(token: string | undefined, secret: string): SessionState | undefined {
  if (!token || token.length > 2_000_000) return undefined;
  const [body, mac] = token.split('.');
  if (!body || !mac) return undefined;
  const want = createHmac('sha256', secret).update(body).digest();
  const got = Buffer.from(mac, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return undefined;
  try {
    const s = JSON.parse(gunzipSync(Buffer.from(body, 'base64url'), { maxOutputLength: 8_000_000 }).toString('utf8')) as SessionState;
    return s && s.v === 1 ? s : undefined;
  } catch { return undefined; }
}
