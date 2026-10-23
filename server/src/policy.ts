import type { Limits } from './config.js';
import type { MomoNetwork } from './phone.js';

export type Check = { id: string; label: string; status: 'pass' | 'review' | 'fail'; detail: string };
export type Decision = 'allow' | 'review' | 'block';

export interface PolicyInput {
  amountUsd: number;
  signatureValid: boolean;
  quoteExpiresAt: string;
  phoneOk: boolean;
  network?: MomoNetwork;
  firstTimeRecipient: boolean;
  initiatedBy: 'human' | 'agent';
  agentFlagged: boolean;
  history: { at: number; amountUsd: number; recipientKey: string }[];
  recipientKey: string;
  now: number;
}

export interface PolicyResult { decision: Decision; checks: Check[]; reviewReasons: string[] }

const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * Default-deny policy for money leaving the platform. The same engine gates humans and the AI
 * agent. Anything it cannot positively verify is blocked; anything unusual goes to a human.
 */
export function evaluate(i: PolicyInput, L: Limits): PolicyResult {
  const checks: Check[] = [];
  const add = (id: string, label: string, status: Check['status'], detail: string) => checks.push({ id, label, status, detail });

  add('quote-signed', 'Quote signed by NEAR Intents', i.signatureValid ? 'pass' : 'fail',
    i.signatureValid ? 'ed25519 signature verified against the 1Click manager key' : 'Signature did not verify, quote refused');
  add('quote-fresh', 'Quote still valid', Date.parse(i.quoteExpiresAt) > i.now ? 'pass' : 'fail',
    Date.parse(i.quoteExpiresAt) > i.now ? 'Within validity window' : 'Quote expired, request a new one');
  add('phone', 'Recipient MoMo number valid', i.phoneOk ? 'pass' : 'fail',
    i.phoneOk ? `Recognised ${i.network} number` : 'Not a recognised Ghana mobile-money number');
  add('min', `Minimum ${usd(L.minUsd)}`, i.amountUsd >= L.minUsd ? 'pass' : 'fail',
    i.amountUsd >= L.minUsd ? 'Above the minimum' : `Below ${usd(L.minUsd)}, fees would dominate`);
  add('per-transfer', `Per-transfer cap ${usd(L.perTransferUsd)}`, i.amountUsd <= L.perTransferUsd ? 'pass' : 'fail',
    i.amountUsd <= L.perTransferUsd ? `${usd(i.amountUsd)} is within the cap` : `${usd(i.amountUsd)} exceeds the cap`);

  const day = i.history.filter((h) => i.now - h.at < 86_400_000).reduce((s, h) => s + h.amountUsd, 0);
  const month = i.history.filter((h) => i.now - h.at < 30 * 86_400_000).reduce((s, h) => s + h.amountUsd, 0);
  add('daily', `24h cap ${usd(L.dailyUsd)}`, day + i.amountUsd <= L.dailyUsd ? 'pass' : 'fail',
    `${usd(day)} already sent in the last 24h, this makes ${usd(day + i.amountUsd)}`);
  add('monthly', `30-day cap ${usd(L.monthlyUsd)}`, month + i.amountUsd <= L.monthlyUsd ? 'pass' : 'fail',
    `${usd(month + i.amountUsd)} over 30 days`);

  const recent = i.history.filter((h) => h.recipientKey === i.recipientKey && i.now - h.at < 3_600_000).length;
  add('velocity', `Max ${L.maxPerRecipientPerHour} per recipient per hour`, recent < L.maxPerRecipientPerHour ? 'pass' : 'fail',
    `${recent} to this recipient in the last hour`);

  const reasons: string[] = [];
  if (i.firstTimeRecipient && i.amountUsd > L.firstRecipientReviewUsd) {
    add('first-recipient', `First payment to a new person over ${usd(L.firstRecipientReviewUsd)}`, 'review', 'Held for the sender to re-confirm the name and number');
    reasons.push('first-time recipient over limit');
  } else add('first-recipient', 'New-recipient check', 'pass', i.firstTimeRecipient ? 'First payment, under the review threshold' : 'Known recipient');

  if (i.initiatedBy === 'agent' && i.amountUsd > L.agentAutoUsd) {
    add('agent-autonomy', `Agent may act alone up to ${usd(L.agentAutoUsd)}`, 'review', 'The agent proposed this, a human must approve it');
    reasons.push('agent over autonomy limit');
  } else if (i.initiatedBy === 'agent') add('agent-autonomy', `Agent may act alone up to ${usd(L.agentAutoUsd)}`, 'pass', 'Within the agent allowance');

  if (i.agentFlagged) {
    add('injection', 'Instruction text screened', 'review', 'The request contained text that looks like an instruction override');
    reasons.push('suspicious instruction text');
  }

  const decision: Decision = checks.some((c) => c.status === 'fail') ? 'block' : checks.some((c) => c.status === 'review') ? 'review' : 'allow';
  return { decision, checks, reviewReasons: reasons };
}
