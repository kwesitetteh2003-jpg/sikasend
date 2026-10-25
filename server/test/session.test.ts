import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { sign, verify } from '../src/session.js';
import { mockFetch } from './helpers.js';

const SECRET = 'test-secret-'.padEnd(40, 'x');
const cfg = () => ({ ...loadConfig({}), demoSpeed: 1000, chaos: true });

describe('signed client-held session (hosted demo)', () => {
  it('a quote made on one instance can be used on a fresh instance', async () => {
    const fetchFn = mockFetch();
    const a = createApp({ cfg: cfg(), fetchFn, session: { v: 1 } });
    const q = (await request(a.app).post('/api/quote').send({ amount: 40, originId: 'base-usdc' }).expect(200)).body;
    const token = sign(a.snapshot(), SECRET);

    const b = createApp({ cfg: cfg(), fetchFn, session: verify(token, SECRET) });
    const t = (await request(b.app).post('/api/transfers').send({ quoteId: q.id, contactId: 'kofi' }).expect(201)).body;
    let token2 = sign(b.snapshot(), SECRET);

    let status = '';
    for (let i = 0; i < 6 && status !== 'paid'; i++) {
      await new Promise((r) => setTimeout(r, 30));
      const c = createApp({ cfg: cfg(), fetchFn, session: verify(token2, SECRET) });
      status = (await request(c.app).get(`/api/transfers/${t.id}`).expect(200)).body.status;
      token2 = sign(c.snapshot(), SECRET);
    }
    expect(status).toBe('paid');
    const d = createApp({ cfg: cfg(), fetchFn, session: verify(token2, SECRET) });
    const ledger = (await request(d.app).get('/api/ledger').expect(200)).body;
    expect(ledger.verify.ok).toBe(true);
    expect(ledger.entries.some((e: { kind: string }) => e.kind === 'payout_retry')).toBe(true); // chaos retry survived the hop
  });

  it('rejects tampered or foreign tokens', () => {
    const token = sign({ v: 1, transfers: { transfers: [], history: [] } }, SECRET);
    expect(verify(token, SECRET)).toBeTruthy();
    expect(verify(token, 'another-secret'.padEnd(40, 'y'))).toBeUndefined();
    const [body, mac] = token.split('.');
    expect(verify(`${body}A.${mac}`, SECRET)).toBeUndefined();
    expect(verify('garbage', SECRET)).toBeUndefined();
    expect(verify(undefined, SECRET)).toBeUndefined();
  });

  it('sessions are isolated between visitors', async () => {
    const fetchFn = mockFetch();
    const a = createApp({ cfg: cfg(), fetchFn, session: { v: 1 } });
    const q = (await request(a.app).post('/api/quote').send({ amount: 40, originId: 'base-usdc' }).expect(200)).body;
    const other = createApp({ cfg: cfg(), fetchFn, session: { v: 1 } });
    await request(other.app).post('/api/transfers').send({ quoteId: q.id, contactId: 'kofi' }).expect(404);
  });
});
