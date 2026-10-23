import type { FetchLike } from './util.js';

export const NEAR_ACCOUNT_RE = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
export const isValidNearAccount = (id: string) => id.length >= 2 && id.length <= 64 && NEAR_ACCOUNT_RE.test(id);

export interface TreasuryStatus {
  account: string;
  source: 'near-rpc';
  rpc: string;
  reachable: boolean;
  exists: boolean;
  implicit: boolean;
  nearBalance?: string; // NEAR, 4dp
  usdcBalance?: string; // USDC, 2dp
  blockHeight?: number;
  error?: string;
}

/** Read-only NEAR JSON-RPC client. Never signs, never sends transactions. */
export class NearReader {
  constructor(private rpc: string, private fetchFn: FetchLike) {}

  private async call(method: string, params: unknown) {
    const r = await this.fetchFn(this.rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'sikasend', method, params }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`rpc http ${r.status}`);
    return (await r.json()) as { result?: any; error?: any };
  }

  async treasury(account: string, usdcContract: string): Promise<TreasuryStatus> {
    const base: TreasuryStatus = { account, source: 'near-rpc', rpc: this.rpc, reachable: false, exists: false, implicit: /^[0-9a-f]{64}$/.test(account) };
    try {
      const acc = await this.call('query', { request_type: 'view_account', finality: 'final', account_id: account });
      base.reachable = true;
      if (acc.error) {
        if (acc.error?.cause?.name === 'UNKNOWN_ACCOUNT') { base.exists = false; base.nearBalance = '0'; base.usdcBalance = '0.00'; return base; }
        throw new Error(acc.error?.data || acc.error?.message || 'rpc error');
      }
      base.exists = true;
      base.blockHeight = acc.result.block_height;
      base.nearBalance = (Number(BigInt(acc.result.amount) / 10n ** 20n) / 10_000).toFixed(4);
      const ft = await this.call('query', {
        request_type: 'call_function', finality: 'final', account_id: usdcContract, method_name: 'ft_balance_of',
        args_base64: Buffer.from(JSON.stringify({ account_id: account })).toString('base64'),
      });
      if (ft.result?.result) {
        const raw = JSON.parse(Buffer.from(ft.result.result).toString('utf8')) as string;
        base.usdcBalance = (Number(BigInt(raw) / 10_000n) / 100).toFixed(2);
      } else base.usdcBalance = '0.00';
      return base;
    } catch (e) {
      base.error = e instanceof Error ? e.message : String(e);
      return base;
    }
  }
}
