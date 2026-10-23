import { randomUUID } from 'node:crypto';
import type { Config } from './config.js';
import { SENDER, type Contact } from './contacts.js';
import type { Ledger } from './ledger.js';
import type { OneClick } from './oneclick.js';
import type { PayoutProvider } from './payout.js';
import { parseGhanaPhone, type MomoNetwork } from './phone.js';
import { evaluate, type PolicyResult } from './policy.js';
import type { PricedQuote, QuoteService } from './quotes.js';
import { HttpError } from './util.js';

export type Status =
  | 'held' | 'awaiting_deposit' | 'deposit_detected' | 'swapping' | 'usdc_settled'
  | 'payout_pending' | 'paid' | 'refunded' | 'failed' | 'cancelled';

const ORDER: Status[] = ['awaiting_deposit', 'deposit_detected', 'swapping', 'usdc_settled', 'payout_pending', 'paid'];

export interface Transfer {
  id: string;
  createdAt: string;
  activatedAt?: number;
  status: Status;
  initiatedBy: 'human' | 'agent';
  mode: 'demo' | 'live';
  purpose?: string;
  recipient: { name: string; phone: string; msisdn: string; network: MomoNetwork; contactId?: string };
  quote: PricedQuote;
  policy: PolicyResult;
  payout?: { provider: string; simulated: boolean; ref?: string; attempts: number; lastError?: string };
  nextPayoutAt?: number;
  refundTo?: string;
  note?: string;
  done: Record<string, string>; // step key -> ISO time
}

export interface CreateInput {
  quoteId: string;
  contactId?: string;
  phone?: string;
  name?: string;
  purpose?: string;
  initiatedBy?: 'human' | 'agent';
  agentFlagged?: boolean;
  refundTo?: string;
}

export interface Deps {
  cfg: Config;
  quotes: QuoteService;
  oc: OneClick;
  ledger: Ledger;
  payout: PayoutProvider;
  contacts: Contact[];
  now: () => number;
}

/** Demo-mode schedule, seconds after activation (scaled by DEMO_SPEED). */
const SCHEDULE = { deposit: 3, swap: 6, settled: 9, payout: 11 } as const;
const RETRY_DELAY = 2;

export class TransferService {
  private transfers = new Map<string, Transfer>();
  private history: { at: number; amountUsd: number; recipientKey: string }[] = [];
  private busy = new Set<string>();
  constructor(private d: Deps) {}

  list(): Transfer[] { return [...this.transfers.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  get(id: string): Transfer { const t = this.transfers.get(id); if (!t) throw new HttpError(404, 'Transfer not found'); return t; }

  totals() {
    const all = this.list();
    const paid = all.filter((t) => t.status === 'paid');
    return {
      count: all.length,
      paid: paid.length,
      inFlight: all.filter((t) => !['paid', 'refunded', 'failed', 'cancelled'].includes(t.status)).length,
      held: all.filter((t) => t.status === 'held').length,
      volumeUsd: paid.reduce((s, t) => s + t.quote.inputUsd, 0),
      paidGhs: paid.reduce((s, t) => s + t.quote.ghsOut, 0),
      savedGhs: paid.reduce((s, t) => s + t.quote.benchmark.savingsGhs, 0),
    };
  }

  async create(inp: CreateInput): Promise<Transfer> {
    const { cfg, ledger, now } = this.d;
    let quote = this.d.quotes.get(inp.quoteId);
    if (!quote) throw new HttpError(404, 'Quote not found or expired. Request a new quote.');
    const contact = inp.contactId ? this.d.contacts.find((c) => c.id === inp.contactId) : undefined;
    if (inp.contactId && !contact) throw new HttpError(404, 'Unknown contact');
    const parsed = contact ? { ok: true as const, msisdn: contact.msisdn, display: contact.phone, network: contact.network } : parseGhanaPhone(inp.phone ?? '');
    const id = randomUUID();
    const recipientKey = parsed.ok ? parsed.msisdn! : `invalid:${inp.phone ?? ''}`;

    const policy = evaluate({
      amountUsd: quote.inputUsd,
      signatureValid: quote.signatureValid,
      quoteExpiresAt: quote.expiresAt,
      phoneOk: parsed.ok,
      network: parsed.ok ? parsed.network : undefined,
      firstTimeRecipient: contact ? contact.priorTransfers === 0 && !this.history.some((h) => h.recipientKey === recipientKey) : !this.history.some((h) => h.recipientKey === recipientKey),
      initiatedBy: inp.initiatedBy ?? 'human',
      agentFlagged: !!inp.agentFlagged,
      history: this.history,
      recipientKey,
      now: now(),
    }, cfg.limits);

    if (policy.decision === 'block') {
      ledger.append(id, 'blocked', { amountUsd: quote.inputUsd, failed: policy.checks.filter((c) => c.status === 'fail').map((c) => c.id) });
      throw new HttpError(422, 'Blocked by policy', { checks: policy.checks, decision: 'block' });
    }
    if (!parsed.ok) throw new HttpError(422, 'Invalid recipient');

    // Live mode: replace the free dry quote with a real one that carries a deposit address.
    if (cfg.mode === 'live') {
      if (!inp.refundTo) throw new HttpError(422, 'Live mode needs a refund address on the origin chain');
      quote = await this.d.quotes.create(quote.origin, quote.inputUsd, { dry: false, refundTo: inp.refundTo });
      if (!quote.signatureValid) throw new HttpError(502, 'Live quote signature invalid, refusing to continue');
    }

    const t: Transfer = {
      id, createdAt: new Date(now()).toISOString(), status: policy.decision === 'review' ? 'held' : 'awaiting_deposit',
      initiatedBy: inp.initiatedBy ?? 'human', mode: cfg.mode, purpose: inp.purpose?.slice(0, 60),
      recipient: { name: contact?.name ?? inp.name ?? parsed.display!, phone: parsed.display!, msisdn: parsed.msisdn!, network: parsed.network!, contactId: contact?.id },
      quote, policy, refundTo: inp.refundTo, done: {},
    };
    this.transfers.set(id, t);
    this.history.push({ at: now(), amountUsd: quote.inputUsd, recipientKey });
    ledger.append(id, 'created', {
      sender: SENDER.id, recipient: parsed.display, network: parsed.network, amountUsd: quote.inputUsd, origin: quote.origin.id,
      quoteSignatureValid: quote.signatureValid, quoteSignature: quote.raw.signature.slice(0, 24) + '…', initiatedBy: t.initiatedBy,
    });
    ledger.append(id, 'policy', { decision: policy.decision, reasons: policy.reviewReasons, checks: policy.checks.map((c) => `${c.id}:${c.status}`) });
    if (t.status === 'awaiting_deposit') this.activate(t);
    return t;
  }

  approve(id: string): Transfer {
    const t = this.get(id);
    if (t.status !== 'held') throw new HttpError(409, 'Only held transfers can be approved');
    this.d.ledger.append(id, 'approved', { by: SENDER.id, reasons: t.policy.reviewReasons });
    t.status = 'awaiting_deposit';
    this.activate(t);
    return t;
  }

  cancel(id: string): Transfer {
    const t = this.get(id);
    if (!['held', 'awaiting_deposit'].includes(t.status)) throw new HttpError(409, 'Too late to cancel: funds are already moving');
    t.status = 'cancelled';
    this.d.ledger.append(id, 'cancelled', { by: SENDER.id });
    return t;
  }

  private activate(t: Transfer) {
    t.activatedAt = this.d.now();
    t.done.awaiting_deposit = new Date(this.d.now()).toISOString();
    this.d.ledger.append(t.id, 'awaiting_deposit', t.mode === 'live' ? { depositAddress: t.quote.depositAddress } : { simulatedDeposit: true });
  }

  private mark(t: Transfer, status: Status, kind: string, data: Record<string, unknown> = {}) {
    t.status = status;
    t.done[status] = new Date(this.d.now()).toISOString();
    this.d.ledger.append(t.id, kind, data);
  }

  /** Move a transfer forward as far as time/upstream state allows. Safe to call repeatedly. */
  async advance(id: string): Promise<Transfer> {
    const t = this.get(id);
    if (this.busy.has(id) || ['held', 'paid', 'refunded', 'failed', 'cancelled'].includes(t.status)) return t;
    this.busy.add(id);
    try {
      if (t.mode === 'demo') await this.advanceDemo(t);
      else await this.advanceLive(t);
    } finally { this.busy.delete(id); }
    return t;
  }

  private async advanceDemo(t: Transfer) {
    const { cfg, now } = this.d;
    const el = ((now() - (t.activatedAt ?? now())) / 1000) * cfg.demoSpeed;
    if (t.status === 'awaiting_deposit' && el >= SCHEDULE.deposit)
      this.mark(t, 'deposit_detected', 'deposit_detected', { simulated: true, chain: t.quote.origin.chain, amountUsd: t.quote.inputUsd });
    if (t.status === 'deposit_detected' && el >= SCHEDULE.swap)
      this.mark(t, 'swapping', 'swap_filled', { simulated: true, solver: 'NEAR Intents market maker', usdcOut: t.quote.usdcOut });
    if (t.status === 'swapping' && el >= SCHEDULE.settled)
      this.mark(t, 'usdc_settled', 'usdc_settled', { simulated: true, to: this.d.cfg.treasury.slice(0, 12) + '…', usdc: t.quote.usdcOut });
    if (t.status === 'usdc_settled' && el >= SCHEDULE.payout) t.status = 'payout_pending';
    if (t.status === 'payout_pending') await this.tryPayout(t, el);
  }

  private async advanceLive(t: Transfer) {
    if (['awaiting_deposit', 'deposit_detected', 'swapping'].includes(t.status) && t.quote.depositAddress) {
      const s = await this.d.oc.status(t.quote.depositAddress, t.quote.depositMemo);
      if (s.status === 'KNOWN_DEPOSIT_TX' && t.status === 'awaiting_deposit') this.mark(t, 'deposit_detected', 'deposit_detected', { simulated: false });
      if (s.status === 'PROCESSING' && ORDER.indexOf(t.status) < 2) {
        if (t.status === 'awaiting_deposit') this.mark(t, 'deposit_detected', 'deposit_detected', { simulated: false });
        this.mark(t, 'swapping', 'swap_filled', { simulated: false });
      }
      if (s.status === 'SUCCESS') {
        for (const [st, k] of [['deposit_detected', 'deposit_detected'], ['swapping', 'swap_filled']] as const)
          if (!t.done[st]) this.mark(t, st, k, { simulated: false });
        this.mark(t, 'usdc_settled', 'usdc_settled', { simulated: false, usdc: t.quote.usdcOut });
        t.status = 'payout_pending';
      }
      if (s.status === 'REFUNDED') { this.mark(t, 'refunded', 'refunded', {}); return; }
      if (s.status === 'FAILED') { this.mark(t, 'failed', 'failed', {}); return; }
      if (s.status === 'INCOMPLETE_DEPOSIT') t.note = 'Deposit received but below the quoted amount; NEAR Intents will refund it.';
    }
    if (t.status === 'payout_pending') await this.tryPayout(t, Infinity);
  }

  private async tryPayout(t: Transfer, el: number) {
    const { payout, ledger, now } = this.d;
    if (t.nextPayoutAt && now() < t.nextPayoutAt) return;
    t.payout ??= { provider: payout.name, simulated: payout.simulated, attempts: 0 };
    t.payout.attempts += 1;
    const res = await payout.disburse({ idempotencyKey: t.id, msisdn: t.recipient.msisdn, network: t.recipient.network, amountGhs: t.quote.ghsOut, reference: `SIKA-${t.id.slice(0, 8)}` });
    if (res.status === 'success') {
      t.payout.ref = res.providerRef;
      t.payout.lastError = undefined;
      this.mark(t, 'paid', 'paid', { amountGhs: t.quote.ghsOut, network: t.recipient.network, providerRef: res.providerRef, attempts: t.payout.attempts, simulated: payout.simulated });
    } else {
      t.payout.lastError = res.error;
      t.nextPayoutAt = now() + (RETRY_DELAY * 1000) / this.d.cfg.demoSpeed;
      ledger.append(t.id, 'payout_retry', { attempt: t.payout.attempts, error: res.error, retryable: !!res.retryable, idempotencyKey: t.id.slice(0, 8) });
      if (!res.retryable || t.payout.attempts >= 4) this.mark(t, 'failed', 'failed', { reason: res.error });
    }
    void el;
  }

  /** What the UI renders: steps with state and timestamps. */
  view(t: Transfer) {
    const idx = t.status === 'held' ? -1 : ORDER.indexOf(t.status);
    const raw = [
      { key: 'awaiting_deposit', label: `Deposit ${t.quote.origin.symbol} on ${t.quote.origin.label}`, sub: t.mode === 'live' ? 'to the one-time NEAR Intents address' : 'simulated sender deposit' },
      { key: 'deposit_detected', label: 'Deposit detected', sub: 'NEAR Intents sees it on the origin chain' },
      { key: 'swapping', label: 'Solvers fill the swap', sub: 'competing market makers, one best price' },
      { key: 'usdc_settled', label: 'USDC lands on NEAR', sub: 'in the SikaSend treasury account' },
      { key: 'payout_pending', label: `Agent pays out to ${t.recipient.network}`, sub: t.payout?.lastError ? `retrying: ${t.payout.lastError}` : 'idempotent disbursement, retries on failure' },
      { key: 'paid', label: `${t.recipient.name.replace(/^(auntie|aunty|uncle|mr|mrs|ms)\.?\s+/i, '').split(' ')[0]} receives GH₵${t.quote.ghsOut.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, sub: 'SMS confirmation from the network' },
    ];
    const terminal = ['paid', 'refunded', 'failed', 'cancelled'].includes(t.status);
    const isDone = (key: string) => {
      if (t.status === 'paid') return true;
      if (key === 'awaiting_deposit') return idx >= 1;
      if (key === 'payout_pending') return false;
      return !!t.done[key];
    };
    let activeAssigned = false;
    const steps = raw.map((s) => {
      const done = isDone(s.key);
      let state: 'done' | 'active' | 'pending' = done ? 'done' : 'pending';
      if (!done && !activeAssigned && t.status !== 'held' && !terminal) { state = 'active'; activeAssigned = true; }
      return { ...s, state, at: t.done[s.key] ?? (s.key === 'payout_pending' ? t.done.paid ?? null : null) };
    });
    return { ...t, steps, ledger: this.d.ledger.forTransfer(t.id) };
  }
}
