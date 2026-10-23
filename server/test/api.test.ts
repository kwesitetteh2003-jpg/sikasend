import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { FIXTURE, makeApp } from './helpers.js';

const quote = async (h: ReturnType<typeof makeApp>, amount = 100, originId = 'base-usdc') =>
  (await request(h.app).post('/api/quote').send({ amount, currency: 'USD', originId }).expect(200)).body;

describe('quote endpoint', () => {
  it('returns a priced, signature-verified quote', async () => {
    const h = makeApp();
    const q = await quote(h);
    expect(q.signatureValid).toBe(true);
    expect(q.dry).toBe(true);
    expect(q.ghsOut).toBeGreaterThan(1000);
    expect(q.fx.source).toBe('live');
  });
  it('flags a fallback FX rate when the live source is down', async () => {
    const h = makeApp({}, { fxRate: null });
    expect((await quote(h)).fx.source).toBe('fallback');
  });
  it('reports a tampered quote as invalid', async () => {
    const bad = structuredClone(FIXTURE); bad.quote.amountOut = '1';
    const h = makeApp({}, { quote: bad });
    expect((await quote(h)).signatureValid).toBe(false);
  });
  it('enforces origin minimums and unknown origins', async () => {
    const h = makeApp();
    await request(h.app).post('/api/quote').send({ amount: 50, originId: 'tron-usdt' }).expect(422);
    await request(h.app).post('/api/quote').send({ amount: 50, originId: 'nope' }).expect(404);
    await request(h.app).post('/api/quote').send({ amount: -1, originId: 'base-usdc' }).expect(400);
  });
  it('surfaces upstream errors as 422/502, not a crash', async () => {
    const h = makeApp({}, { quote: { message: 'refundTo is not valid' }, quoteStatus: 400 });
    const r = await request(h.app).post('/api/quote').send({ amount: 100, originId: 'base-usdc' });
    expect(r.status).toBe(422);
    expect(r.body.error).toMatch(/refundTo/);
  });
});

describe('transfer lifecycle (demo mode)', () => {
  it('runs deposit -> swap -> USDC -> payout (with one retry) -> paid, with a verifiable ledger', async () => {
    const h = makeApp();
    const q = await quote(h);
    const created = (await request(h.app).post('/api/transfers').send({ quoteId: q.id, contactId: 'akosua', purpose: 'school fees' }).expect(201)).body;
    expect(created.status).toBe('awaiting_deposit');
    expect(created.steps[0].state).toBe('active');
    const get = async () => (await request(h.app).get(`/api/transfers/${created.id}`).expect(200)).body;

    h.tick(3.5); expect((await get()).status).toBe('deposit_detected');
    h.tick(3); expect((await get()).status).toBe('swapping');
    h.tick(3); expect((await get()).status).toBe('usdc_settled');
    h.tick(2); let t = await get();
    expect(t.status).toBe('payout_pending'); // first MoMo attempt timed out
    expect(t.payout.attempts).toBe(1);
    expect(t.payout.lastError).toMatch(/timeout/);
    h.tick(2.5); t = await get();
    expect(t.status).toBe('paid');
    expect(t.payout.attempts).toBe(2);
    expect(t.payout.simulated).toBe(true);
    expect(t.steps.every((s: any) => s.state === 'done')).toBe(true);

    const kinds = t.ledger.map((e: any) => e.kind);
    expect(kinds).toEqual(['created', 'policy', 'awaiting_deposit', 'deposit_detected', 'swap_filled', 'usdc_settled', 'payout_retry', 'paid']);
    const l = (await request(h.app).get('/api/ledger').expect(200)).body;
    expect(l.verify.ok).toBe(true);
    const totals = (await request(h.app).get('/api/transfers').expect(200)).body.totals;
    expect(totals.paid).toBe(1);
    expect(totals.volumeUsd).toBe(100);
  });

  it('pays exactly once even if the UI polls repeatedly', async () => {
    const h = makeApp({ chaos: false });
    const q = await quote(h);
    const c = (await request(h.app).post('/api/transfers').send({ quoteId: q.id, contactId: 'akosua' })).body;
    h.tick(30);
    await Promise.all(Array.from({ length: 6 }, () => request(h.app).get(`/api/transfers/${c.id}`)));
    const t = (await request(h.app).get(`/api/transfers/${c.id}`)).body;
    expect(t.status).toBe('paid');
    expect(t.ledger.filter((e: any) => e.kind === 'paid')).toHaveLength(1);
  });

  it('holds a large first-time payment until the sender approves', async () => {
    const h = makeApp();
    const q = await quote(h, 400);
    const c = (await request(h.app).post('/api/transfers').send({ quoteId: q.id, contactId: 'kofi' }).expect(201)).body;
    expect(c.status).toBe('held');
    h.tick(30);
    expect((await request(h.app).get(`/api/transfers/${c.id}`)).body.status).toBe('held'); // time alone never releases it
    const a = (await request(h.app).post(`/api/transfers/${c.id}/approve`).expect(200)).body;
    expect(a.status).toBe('awaiting_deposit');
    expect(a.ledger.map((e: any) => e.kind)).toContain('approved');
  });

  it('blocks over-limit, bad-number and unsigned-quote transfers with the failing checks', async () => {
    const h = makeApp();
    const big = await quote(h, 1500);
    let r = await request(h.app).post('/api/transfers').send({ quoteId: big.id, contactId: 'akosua' }).expect(422);
    expect(r.body.checks.find((c: any) => c.id === 'per-transfer').status).toBe('fail');

    const q = await quote(h);
    r = await request(h.app).post('/api/transfers').send({ quoteId: q.id, phone: '0301234567' }).expect(422);
    expect(r.body.checks.find((c: any) => c.id === 'phone').status).toBe('fail');

    const bad = structuredClone(FIXTURE); bad.quote.amountOut = '1';
    const h2 = makeApp({}, { quote: bad });
    const q2 = await quote(h2);
    r = await request(h2.app).post('/api/transfers').send({ quoteId: q2.id, contactId: 'akosua' }).expect(422);
    expect(r.body.checks.find((c: any) => c.id === 'quote-signed').status).toBe('fail');
  });

  it('blocks an expired quote', async () => {
    const h = makeApp();
    const q = await quote(h);
    h.tick(11 * 60);
    await request(h.app).post('/api/transfers').send({ quoteId: q.id, contactId: 'akosua' }).expect(422);
  });

  it('rate-limits repeated payments to the same person', async () => {
    const h = makeApp();
    for (let i = 0; i < 3; i++) {
      const q = await quote(h, 20);
      await request(h.app).post('/api/transfers').send({ quoteId: q.id, contactId: 'akosua' }).expect(201);
    }
    const q = await quote(h, 20);
    const r = await request(h.app).post('/api/transfers').send({ quoteId: q.id, contactId: 'akosua' }).expect(422);
    expect(r.body.checks.find((c: any) => c.id === 'velocity').status).toBe('fail');
  });

  it('cancels before the deposit but not after', async () => {
    const h = makeApp();
    const q = await quote(h);
    const c = (await request(h.app).post('/api/transfers').send({ quoteId: q.id, contactId: 'akosua' })).body;
    h.tick(4); await request(h.app).get(`/api/transfers/${c.id}`);
    await request(h.app).post(`/api/transfers/${c.id}/cancel`).expect(409);
    const q2 = await quote(h);
    const c2 = (await request(h.app).post('/api/transfers').send({ quoteId: q2.id, contactId: 'abena' })).body;
    expect((await request(h.app).post(`/api/transfers/${c2.id}/cancel`).expect(200)).body.status).toBe('cancelled');
  });
});

describe('agent', () => {
  it('turns text into a prepared intent but never sends', async () => {
    const h = makeApp();
    const r = (await request(h.app).post('/api/agent/parse').send({ text: 'Send $200 to Auntie Akosua for school fees' }).expect(200)).body;
    expect(r.intent.amount).toBe(200);
    expect(r.contact.id).toBe('akosua');
    expect((await request(h.app).get('/api/transfers')).body.transfers).toHaveLength(0);
  });
  it('agent-initiated transfers above the allowance need human approval', async () => {
    const h = makeApp();
    const q = await quote(h, 200);
    const c = (await request(h.app).post('/api/transfers').send({ quoteId: q.id, contactId: 'akosua', initiatedBy: 'agent' })).body;
    expect(c.status).toBe('held');
    expect(c.policy.reviewReasons).toContain('agent over autonomy limit');
  });
  it('an injected instruction forces review even for a small amount', async () => {
    const h = makeApp();
    const q = await quote(h, 40);
    const c = (await request(h.app).post('/api/transfers').send({ quoteId: q.id, contactId: 'akosua', initiatedBy: 'agent', agentFlagged: true })).body;
    expect(c.status).toBe('held');
  });
});

describe('live mode (mocked upstream)', () => {
  it('requires a refund address, requests a non-dry quote and follows the 1Click status to payout', async () => {
    const calls: string[] = [];
    const mock = { calls, status: 'PENDING_DEPOSIT' };
    const h = makeApp({ mode: 'live', chaos: false }, mock);
    const q = await quote(h);
    await request(h.app).post('/api/transfers').send({ quoteId: q.id, contactId: 'akosua' }).expect(422);
    const c = (await request(h.app).post('/api/transfers').send({ quoteId: q.id, contactId: 'akosua', refundTo: '0x2527D02599Ba641c19FEa793cD0F167589a0f10D' }).expect(201)).body;
    expect(c.quote.dry).toBe(false);
    expect(c.quote.depositAddress).toBe('0xDEPOSIT');
    expect((await request(h.app).get(`/api/transfers/${c.id}`)).body.status).toBe('awaiting_deposit');
    mock.status = 'SUCCESS';
    const t = (await request(h.app).get(`/api/transfers/${c.id}`)).body;
    expect(t.status).toBe('paid');
    expect(calls.some((x) => x.includes('/v0/status?depositAddress=0xDEPOSIT'))).toBe(true);
  });
  it('records a refund', async () => {
    const mock = { status: 'PENDING_DEPOSIT' };
    const h = makeApp({ mode: 'live' }, mock);
    const q = await quote(h);
    const c = (await request(h.app).post('/api/transfers').send({ quoteId: q.id, contactId: 'akosua', refundTo: '0x2527D02599Ba641c19FEa793cD0F167589a0f10D' })).body;
    mock.status = 'REFUNDED';
    expect((await request(h.app).get(`/api/transfers/${c.id}`)).body.status).toBe('refunded');
  });
});

describe('ops + NEAR', () => {
  it('shows the treasury from NEAR RPC', async () => {
    const h = makeApp({}, { rpc: (b: any) => b.params.request_type === 'view_account' ? { result: { amount: '1000000000000000000000000', block_height: 1 } } : { result: { result: [...Buffer.from('"5000000"')] } } });
    const s = (await request(h.app).get('/api/ops/summary').expect(200)).body;
    expect(s.treasury).toMatchObject({ exists: true, usdcBalance: '5.00' });
    expect(s.payoutProvider.simulated).toBe(true);
  });
  it('rejects malformed NEAR account ids', async () => {
    const h = makeApp();
    await request(h.app).get('/api/near/account/BAD%20ID').expect(422);
  });
});
