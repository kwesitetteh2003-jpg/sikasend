import type { AgentParse, AppConfig, LedgerEntry, OpsSummary, Quote, Totals, Transfer } from './types';

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: any) { super(message); }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch('/api' + path, { ...init, headers: { 'content-type': 'application/json' } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(body.error ?? `Request failed (${r.status})`, r.status, body);
  return body as T;
}

const post = <T,>(p: string, b?: unknown) => req<T>(p, { method: 'POST', body: b === undefined ? undefined : JSON.stringify(b) });

export const api = {
  config: () => req<AppConfig>('/config'),
  quote: (amount: number, currency: 'USD' | 'GHS', originId: string) => post<Quote>('/quote', { amount, currency, originId }),
  parse: (text: string) => post<AgentParse>('/agent/parse', { text }),
  create: (b: { quoteId: string; contactId?: string; phone?: string; name?: string; purpose?: string; initiatedBy?: 'human' | 'agent'; agentFlagged?: boolean; refundTo?: string }) => post<Transfer>('/transfers', b),
  transfer: (id: string) => req<Transfer>(`/transfers/${id}`),
  transfers: () => req<{ totals: Totals; transfers: Transfer[] }>('/transfers'),
  approve: (id: string) => post<Transfer>(`/transfers/${id}/approve`),
  cancel: (id: string) => post<Transfer>(`/transfers/${id}/cancel`),
  ledger: () => req<{ verify: { ok: boolean; length: number; head: string }; entries: LedgerEntry[] }>('/ledger'),
  ops: () => req<OpsSummary>('/ops/summary'),
};
