import type { AgentParse, AppConfig, LedgerEntry, OpsSummary, Quote, Totals, Transfer } from './types';

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: any) { super(message); }
}

/*
 * Hosted demo: the server keeps no state. Each visitor's quotes, transfers and ledger travel as a signed
 * session token (kept in localStorage) through POST /api/__session, so any serverless instance can answer
 * any request. A local or live server has no such route; then we fall back to plain REST.
 */
const KEY = 'sikasend-session-v1';
const STATELESS = [/^\/config$/, /^\/agent\/parse$/, /^\/near\//, /^\/health$/];
let mode: 'unknown' | 'session' | 'plain' = 'unknown';
let queue: Promise<unknown> = Promise.resolve();
const FALLBACK = Symbol('fallback');

const load = () => { try { return localStorage.getItem(KEY) ?? undefined; } catch { return undefined; } };
const save = (t: string) => { try { localStorage.setItem(KEY, t); } catch { /* private mode */ } };

async function plain<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch('/api' + path, { ...init, headers: { 'content-type': 'application/json' } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(body.error ?? `Request failed (${r.status})`, r.status, body);
  return body as T;
}

async function viaSession<T>(path: string, init?: RequestInit): Promise<T | typeof FALLBACK> {
  const r = await fetch('/api/__session', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-sika-envelope': '1' },
    body: JSON.stringify({ method: init?.method ?? 'GET', path: '/api' + path, body: init?.body ? JSON.parse(String(init.body)) : undefined, session: load() }),
  });
  if (r.headers.get('x-sika-session') !== 'on') return FALLBACK;
  const out = await r.json().catch(() => ({})) as { data?: any; session?: string };
  if (out.session) save(out.session);
  const body = out.data ?? {};
  if (!r.ok) throw new ApiError(body.error ?? `Request failed (${r.status})`, r.status, body);
  return body as T;
}

async function run<T>(path: string, init?: RequestInit): Promise<T> {
  if (mode !== 'plain') {
    const out = await viaSession<T>(path, init);
    if (out !== FALLBACK) { mode = 'session'; return out; }
    mode = 'plain';
  }
  return plain<T>(path, init);
}

function req<T>(path: string, init?: RequestInit): Promise<T> {
  if (STATELESS.some((re) => re.test(path))) return plain<T>(path, init);
  // one stateful call at a time, so a tracker poll cannot overwrite the session a click just produced
  const p = queue.then(() => run<T>(path, init));
  queue = p.catch(() => undefined);
  return p;
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
