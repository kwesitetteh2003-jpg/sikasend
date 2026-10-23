export interface Origin { id: string; chain: string; label: string; symbol: string; minUsd: number }
export interface Contact { id: string; name: string; relation: string; city: string; phone: string; msisdn: string; network: string; priorTransfers: number; color: string }
export interface Rate { ghsPerUsd: number; source: 'live' | 'fallback'; asOf: string; provider: string }
export interface Limits { minUsd: number; perTransferUsd: number; dailyUsd: number; monthlyUsd: number; firstRecipientReviewUsd: number; agentAutoUsd: number; maxPerRecipientPerHour: number }
export interface AppConfig {
  mode: 'demo' | 'live'; sender: { id: string; name: string; city: string }; origins: Origin[]; contacts: Contact[]; treasury: string;
  payoutProvider: { name: string; simulated: boolean }; fx: Rate; fees: { platformFeeBps: number; fxSpreadBps: number };
  benchmark: { costPct: number; source: string }; limits: Limits; llm: boolean;
}
export interface Quote {
  id: string; createdAt: string; expiresAt: string; origin: Origin; dry: boolean; signatureValid: boolean; timeEstimateSec: number;
  inputUsd: number; usdcOut: number; usdcOutMin: number; networkFeeUsd: number; platformFeeUsd: number;
  fx: Rate & { appliedGhsPerUsd: number; spreadBps: number }; ghsOut: number; ghsOutMin: number; costPct: number; costUsd: number;
  benchmark: { costPct: number; ghsOut: number; savingsGhs: number; source: string };
  depositAddress?: string; raw: { signature: string; timestamp: string };
}
export interface Check { id: string; label: string; status: 'pass' | 'review' | 'fail'; detail: string }
export interface AgentParse {
  via: 'rules' | 'llm';
  intent: { amount?: number; currency?: 'USD' | 'GHS'; contactId?: string; phone?: string; originId?: string; purpose?: string };
  contact?: Contact; missing: string[]; flagged: boolean; flagReasons: string[]; reply: string;
}
export type Status = 'held' | 'awaiting_deposit' | 'deposit_detected' | 'swapping' | 'usdc_settled' | 'payout_pending' | 'paid' | 'refunded' | 'failed' | 'cancelled';
export interface LedgerEntry { seq: number; at: string; transferId: string; kind: string; data: Record<string, unknown>; prevHash: string; hash: string }
export interface Step { key: string; label: string; sub: string; state: 'done' | 'active' | 'pending'; at: string | null }
export interface Transfer {
  id: string; createdAt: string; status: Status; initiatedBy: 'human' | 'agent'; mode: 'demo' | 'live'; purpose?: string;
  recipient: { name: string; phone: string; msisdn: string; network: string; contactId?: string };
  quote: Quote; policy: { decision: 'allow' | 'review' | 'block'; checks: Check[]; reviewReasons: string[] };
  payout?: { provider: string; simulated: boolean; ref?: string; attempts: number; lastError?: string };
  note?: string; steps: Step[]; ledger: LedgerEntry[];
}
export interface Treasury {
  source?: string; rpc?: string; account: string; reachable: boolean; exists: boolean; implicit: boolean; nearBalance: string; usdcBalance: string; blockHeight?: number; error?: string }
export interface OpsSummary {
  mode: string; treasury: Treasury; fx: Rate; payoutProvider: { name: string; simulated: boolean };
  totals: Totals;
  limits: Limits; ledger: { ok: boolean; length: number; brokenAt?: number; head: string };
}
export interface Totals { count: number; paid: number; inFlight: number; held: number; volumeUsd: number; paidGhs: number; savedGhs: number }
