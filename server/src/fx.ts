import type { FetchLike } from './util.js';

export interface Rate { ghsPerUsd: number; source: 'live' | 'fallback'; asOf: string; provider: string }

// Used only when the live FX call fails. Clearly reported as "fallback" in the API and UI.
const FALLBACK = 11.5;

export class FxService {
  private cache?: { at: number; rate: Rate };
  constructor(private fetchFn: FetchLike, private now: () => number = Date.now) {}

  async ghsPerUsd(): Promise<Rate> {
    if (this.cache && this.now() - this.cache.at < 5 * 60_000) return this.cache.rate;
    try {
      const r = await this.fetchFn('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error(`fx ${r.status}`);
      const j = (await r.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
      const v = j.rates?.GHS;
      if (j.result !== 'success' || typeof v !== 'number' || !(v > 0)) throw new Error('fx bad payload');
      const rate: Rate = { ghsPerUsd: v, source: 'live', asOf: j.time_last_update_utc ?? new Date(this.now()).toISOString(), provider: 'open.er-api.com' };
      this.cache = { at: this.now(), rate };
      return rate;
    } catch {
      return { ghsPerUsd: FALLBACK, source: 'fallback', asOf: new Date(this.now()).toISOString(), provider: 'static fallback' };
    }
  }
}
