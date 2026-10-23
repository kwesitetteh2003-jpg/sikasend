import { randomUUID } from 'node:crypto';
import type { Config } from './config.js';
import type { FxService, Rate } from './fx.js';
import type { OneClick, OneClickQuoteResponse } from './oneclick.js';
import type { Origin } from './origins.js';
import { round } from './util.js';

export interface PricedQuote {
  id: string;
  createdAt: string;
  expiresAt: string;
  origin: Origin;
  dry: boolean;
  signatureValid: boolean;
  correlationId?: string;
  timeEstimateSec: number;
  inputUsd: number;
  /** USDC delivered to the treasury on NEAR (guaranteed minimum shown separately). */
  usdcOut: number;
  usdcOutMin: number;
  networkFeeUsd: number;
  platformFeeUsd: number;
  fx: Rate & { appliedGhsPerUsd: number; spreadBps: number };
  ghsOut: number;
  ghsOutMin: number;
  /** All-in cost versus the mid-market rate, in % and USD. */
  costPct: number;
  costUsd: number;
  benchmark: { costPct: number; ghsOut: number; savingsGhs: number; source: string };
  depositAddress?: string;
  depositMemo?: string;
  raw: { amountIn: string; amountOut: string; minAmountOut: string; withdrawFee?: string; refundFee?: string; timestamp: string; signature: string };
}

const BENCHMARK_SOURCE = 'World Bank Remittance Prices Worldwide, Q3 2025: Sub-Saharan Africa average cost of sending $200';

export class QuoteService {
  private store = new Map<string, { q: PricedQuote; resp: OneClickQuoteResponse }>();
  constructor(private cfg: Config, private oc: OneClick, private fx: FxService, private now: () => number = Date.now) {}

  async create(origin: Origin, amountUsd: number, opts: { dry?: boolean; refundTo?: string } = {}): Promise<PricedQuote> {
    const dry = opts.dry ?? true;
    const [res, rate] = await Promise.all([
      this.oc.quote({ origin, amountUsd, dry, refundTo: opts.refundTo }),
      this.fx.ghsPerUsd(),
    ]);
    const q = price(this.cfg, origin, amountUsd, res.response, res.signatureValid, dry, rate, this.now());
    this.store.set(q.id, { q, resp: res.response });
    this.gc();
    return q;
  }

  get(id: string): PricedQuote | undefined {
    const e = this.store.get(id);
    return e?.q;
  }

  private gc() {
    const t = this.now();
    for (const [k, v] of this.store) if (Date.parse(v.q.expiresAt) + 3600_000 < t) this.store.delete(k);
  }
}

/** Pure pricing: everything the recipient and sender see is derived here so it can be unit-tested. */
export function price(cfg: Config, origin: Origin, inputUsd: number, resp: OneClickQuoteResponse, signatureValid: boolean, dry: boolean, rate: Rate, nowMs: number): PricedQuote {
  const out = Number(resp.quote.amountOutFormatted);
  const minOut = Number(BigInt(resp.quote.minAmountOut) / 10_000n) / 100;
  const platformFee = out * (cfg.platformFeeBps / 10_000);
  const applied = rate.ghsPerUsd * (1 - cfg.fxSpreadBps / 10_000);
  const ghsOut = (out - platformFee) * applied;
  const ghsOutMin = (minOut - minOut * (cfg.platformFeeBps / 10_000)) * applied;
  const midValue = ghsOut / rate.ghsPerUsd; // USD value delivered at mid-market
  const costUsd = inputUsd - midValue;
  const benchOut = inputUsd * (1 - cfg.benchmarkPct / 100) * rate.ghsPerUsd;
  const expires = resp.quote.deadline ? Date.parse(resp.quote.deadline) : nowMs + 30 * 60_000;
  return {
    id: randomUUID(),
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(Math.min(expires, nowMs + 10 * 60_000)).toISOString(),
    origin, dry, signatureValid,
    correlationId: resp.correlationId,
    timeEstimateSec: resp.quote.timeEstimate ?? 60,
    inputUsd: round(inputUsd),
    usdcOut: round(out, 4),
    usdcOutMin: round(minOut, 4),
    networkFeeUsd: round(Math.max(0, inputUsd - out), 4),
    platformFeeUsd: round(platformFee, 4),
    fx: { ...rate, appliedGhsPerUsd: round(applied, 4), spreadBps: cfg.fxSpreadBps },
    ghsOut: round(ghsOut), ghsOutMin: round(ghsOutMin),
    costUsd: round(costUsd, 4),
    costPct: round((costUsd / inputUsd) * 100, 2),
    benchmark: { costPct: cfg.benchmarkPct, ghsOut: round(benchOut), savingsGhs: round(ghsOut - benchOut), source: BENCHMARK_SOURCE },
    depositAddress: resp.quote.depositAddress,
    depositMemo: resp.quote.depositMemo,
    raw: { amountIn: resp.quote.amountIn, amountOut: resp.quote.amountOut, minAmountOut: resp.quote.minAmountOut, withdrawFee: resp.quote.withdrawFee, refundFee: resp.quote.refundFee, timestamp: resp.timestamp, signature: resp.signature },
  };
}
