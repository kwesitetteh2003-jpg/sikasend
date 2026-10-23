import { verifyQuoteSignature } from '@defuse-protocol/one-click-sdk-typescript';
import type { Config } from './config.js';
import { USDC_NEAR } from './config.js';
import type { Origin } from './origins.js';
import { HttpError, type FetchLike } from './util.js';

export interface OneClickQuoteResponse {
  quote: {
    amountIn: string; amountInFormatted: string; amountInUsd?: string;
    minAmountIn?: string; amountOut: string; amountOutFormatted: string; amountOutUsd?: string;
    minAmountOut: string; timeEstimate?: number; depositAddress?: string; depositMemo?: string;
    deadline?: string; refundFee?: string; withdrawFee?: string;
  };
  quoteRequest: Record<string, unknown>;
  signature: string;
  timestamp: string;
  correlationId?: string;
}

export interface QuoteResult {
  response: OneClickQuoteResponse;
  signatureValid: boolean;
  dry: boolean;
}

export type OneClickStatus =
  | 'PENDING_DEPOSIT' | 'KNOWN_DEPOSIT_TX' | 'PROCESSING' | 'SUCCESS'
  | 'INCOMPLETE_DEPOSIT' | 'REFUNDED' | 'FAILED';

const toBaseUnits = (usd: number, decimals: number) => {
  const [i, f = ''] = usd.toFixed(decimals).split('.');
  return (BigInt(i!) * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0')).toString();
};

/** Thin client over the public 1Click REST API (NEAR Intents). */
export class OneClick {
  constructor(private cfg: Config, private fetchFn: FetchLike) {}

  private headers() {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (this.cfg.oneclickJwt) h.authorization = `Bearer ${this.cfg.oneclickJwt}`;
    return h;
  }

  /**
   * Request a quote: stablecoin on `origin` chain -> USDC on NEAR, delivered to the treasury account.
   * dry=true returns a real, signed price without creating a deposit address (nothing can be spent).
   */
  async quote(opts: { origin: Origin; amountUsd: number; dry: boolean; refundTo?: string; ttlMinutes?: number }): Promise<QuoteResult> {
    const deadline = new Date(Date.now() + (opts.ttlMinutes ?? 30) * 60_000).toISOString();
    const body = {
      dry: opts.dry,
      swapType: 'EXACT_INPUT',
      slippageTolerance: 50, // 0.5 %
      originAsset: opts.origin.assetId,
      depositType: 'ORIGIN_CHAIN',
      destinationAsset: `nep141:${this.cfg.usdcContract || USDC_NEAR}`,
      amount: toBaseUnits(opts.amountUsd, opts.origin.decimals),
      refundTo: opts.refundTo ?? opts.origin.dryRefundTo,
      refundType: 'ORIGIN_CHAIN',
      recipient: this.cfg.treasury,
      recipientType: 'DESTINATION_CHAIN',
      deadline,
    };
    const r = await this.fetchFn(`${this.cfg.oneclickBase}/v0/quote`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    let j: any;
    try { j = JSON.parse(text); } catch { j = { message: text.slice(0, 200) }; }
    if (!r.ok || !j.quote) {
      throw new HttpError(r.status === 400 || r.status === 401 || r.status === 403 ? 422 : 502, `NEAR Intents quote failed: ${j.message ?? r.status}`, { upstreamStatus: r.status });
    }
    return { response: j as OneClickQuoteResponse, signatureValid: this.verify(j), dry: opts.dry };
  }

  verify(j: unknown): boolean {
    try { return verifyQuoteSignature(j as any); } catch { return false; }
  }

  async status(depositAddress: string, depositMemo?: string): Promise<{ status: OneClickStatus; raw: unknown }> {
    const u = new URL(`${this.cfg.oneclickBase}/v0/status`);
    u.searchParams.set('depositAddress', depositAddress);
    if (depositMemo) u.searchParams.set('depositMemo', depositMemo);
    const r = await this.fetchFn(u.toString(), { headers: this.headers(), signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new HttpError(502, `NEAR Intents status failed: HTTP ${r.status}`);
    const j = (await r.json()) as { status: OneClickStatus };
    return { status: j.status, raw: j };
  }
}
