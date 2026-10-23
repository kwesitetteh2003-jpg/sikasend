import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadConfig, type Config } from '../src/config.js';
import { createApp } from '../src/app.js';
import type { FetchLike } from '../src/util.js';

const here = dirname(fileURLToPath(import.meta.url));
/** A real, signed dry quote captured from the live 1Click API (100 USDC on Base -> USDC on NEAR). */
export const FIXTURE = JSON.parse(readFileSync(join(here, 'fixtures', 'quote-100.json'), 'utf8'));

export interface MockOpts {
  quote?: unknown;
  quoteStatus?: number;
  status?: string;
  fxRate?: number | null;
  rpc?: (body: any) => unknown;
  calls?: string[];
}

export function mockFetch(o: MockOpts = {}): FetchLike {
  return async (url, init) => {
    o.calls?.push(`${init?.method ?? 'GET'} ${url}`);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
    if (url.includes('/v0/quote')) {
      const body = JSON.parse(String(init?.body));
      const q = structuredClone(o.quote ?? FIXTURE);
      if (!body.dry && !q.quote.depositAddress) q.quote.depositAddress = '0xDEPOSIT';
      return json(q, o.quoteStatus ?? 201);
    }
    if (url.includes('/v0/status')) return json({ status: o.status ?? 'PENDING_DEPOSIT' });
    if (url.includes('open.er-api.com')) {
      if (o.fxRate === null) return json({}, 500);
      return json({ result: 'success', rates: { GHS: o.fxRate ?? 11.6 }, time_last_update_utc: 'Fri, 23 Oct 2026 00:02:31 +0000' });
    }
    if (o.rpc) return json(o.rpc(JSON.parse(String(init?.body))));
    return json({ error: 'unmocked ' + url }, 500);
  };
}

export function makeApp(over: Partial<Config> = {}, mock: MockOpts = {}) {
  const clock = { t: Date.parse(FIXTURE.timestamp) + 1000 };
  const cfg = { ...loadConfig({}), ...over } as Config;
  const built = createApp({ cfg, fetchFn: mockFetch(mock), now: () => clock.t });
  return { ...built, clock, tick: (s: number) => { clock.t += s * 1000; } };
}
