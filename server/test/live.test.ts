import { describe, expect, it } from 'vitest';
import { loadConfig, DEMO_TREASURY } from '../src/config.js';
import { OneClick } from '../src/oneclick.js';
import { ORIGINS } from '../src/origins.js';
import { NearReader } from '../src/near.js';

/** Hits the real public 1Click API and NEAR RPC. Free (dry quote). Run with: LIVE_TESTS=1 npm test */
describe.skipIf(!process.env.LIVE_TESTS)('live NEAR Intents + NEAR RPC', () => {
  const cfg = loadConfig({});
  it('returns a real signed dry quote that verifies', async () => {
    const oc = new OneClick(cfg, fetch);
    const r = await oc.quote({ origin: ORIGINS[0]!, amountUsd: 50, dry: true });
    expect(r.signatureValid).toBe(true);
    expect(Number(r.response.quote.amountOutFormatted)).toBeGreaterThan(49);
  }, 30_000);
  it('reads the treasury account from NEAR RPC', async () => {
    const t = await new NearReader(cfg.nearRpc, fetch).treasury(DEMO_TREASURY, cfg.usdcContract);
    expect(t.reachable).toBe(true);
  }, 30_000);
});
