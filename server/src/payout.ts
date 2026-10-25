import type { MomoNetwork } from './phone.js';

export interface DisburseRequest {
  idempotencyKey: string;
  msisdn: string;
  network: MomoNetwork;
  amountGhs: number;
  reference: string;
}

export interface DisburseResult {
  status: 'success' | 'failed';
  providerRef?: string;
  error?: string;
  retryable?: boolean;
}

export interface PayoutProvider {
  readonly name: string;
  /** true = nothing real is paid. Surfaced in the API and UI. */
  readonly simulated: boolean;
  disburse(req: DisburseRequest): Promise<DisburseResult>;
}

/**
 * SIMULATED mobile-money rail. No money moves. In chaos mode the first attempt for each
 * idempotency key times out so the agent's retry path is visible; later attempts with the same
 * key succeed exactly once (idempotent), which is what a real MoMo disbursement API must give us.
 */
export class SimulatedMomo implements PayoutProvider {
  readonly name = 'Simulated MoMo (no real payout)';
  readonly simulated = true;
  private attempts = new Map<string, number>();
  private done = new Map<string, DisburseResult>();
  constructor(private chaos = true) {}

  snapshot() { return { attempts: [...this.attempts], done: [...this.done] }; }
  restore(s: { attempts?: Array<[string, number]>; done?: Array<[string, DisburseResult]> }) {
    this.attempts = new Map(s.attempts ?? []);
    this.done = new Map(s.done ?? []);
  }

  async disburse(req: DisburseRequest): Promise<DisburseResult> {
    const prior = this.done.get(req.idempotencyKey);
    if (prior) return prior;
    const n = (this.attempts.get(req.idempotencyKey) ?? 0) + 1;
    this.attempts.set(req.idempotencyKey, n);
    if (this.chaos && n === 1) return { status: 'failed', error: `${req.network} gateway timeout`, retryable: true };
    const res: DisburseResult = { status: 'success', providerRef: `SIM-${req.idempotencyKey.slice(0, 8).toUpperCase()}` };
    this.done.set(req.idempotencyKey, res);
    return res;
  }
}
