import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { parseWithLlm } from './agent.js';
import { loadConfig, type Config } from './config.js';
import { CONTACTS, SENDER } from './contacts.js';
import { FxService } from './fx.js';
import { Ledger } from './ledger.js';
import { NearReader, isValidNearAccount } from './near.js';
import { OneClick } from './oneclick.js';
import { findOrigin, ORIGINS } from './origins.js';
import { SimulatedMomo, type PayoutProvider } from './payout.js';
import { QuoteService } from './quotes.js';
import { TransferService } from './transfers.js';
import { HttpError, type FetchLike } from './util.js';

export interface AppOptions {
  cfg?: Config;
  fetchFn?: FetchLike;
  now?: () => number;
  payout?: PayoutProvider;
  /** Reuse one FX cache across requests (the hosted demo builds an app per request). */
  fx?: FxService;
  /** Restore a visitor's demo session (see session.ts). */
  session?: SessionState;
}

/** Everything a demo visitor owns: quotes, transfers, velocity history, their ledger chain, payout idempotency. */
export interface SessionState {
  v: 1;
  quotes?: ReturnType<QuoteService['snapshot']>;
  transfers?: ReturnType<TransferService['snapshot']>;
  ledger?: ReturnType<Ledger['snapshot']>;
  momo?: ReturnType<SimulatedMomo['snapshot']>;
}

export function createApp(opts: AppOptions = {}) {
  const cfg = opts.cfg ?? loadConfig();
  const fetchFn: FetchLike = opts.fetchFn ?? ((u, i) => fetch(u, i));
  const now = opts.now ?? Date.now;
  const fx = opts.fx ?? new FxService(fetchFn, now);
  const oc = new OneClick(cfg, fetchFn);
  const quotes = new QuoteService(cfg, oc, fx, now);
  const ledger = new Ledger(now);
  const payout = opts.payout ?? new SimulatedMomo(cfg.chaos);
  const near = new NearReader(cfg.nearRpc, fetchFn);
  const transfers = new TransferService({ cfg, quotes, oc, ledger, payout, contacts: CONTACTS, now });
  if (opts.session) {
    quotes.restore(opts.session.quotes ?? []);
    transfers.restore(opts.session.transfers ?? {});
    ledger.restore(opts.session.ledger ?? []);
    if (payout instanceof SimulatedMomo) payout.restore(opts.session.momo ?? {});
  }
  const snapshot = (): SessionState => ({
    v: 1, quotes: quotes.snapshot(), transfers: transfers.snapshot(), ledger: ledger.snapshot(),
    momo: payout instanceof SimulatedMomo ? payout.snapshot() : undefined,
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown> | unknown) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);

  app.get('/api/health', (_req, res) => res.json({ ok: true, mode: cfg.mode }));

  app.get('/api/config', wrap(async (_req, res) => {
    const rate = await fx.ghsPerUsd();
    res.json({
      mode: cfg.mode,
      sender: SENDER,
      origins: ORIGINS.map(({ id, chain, label, symbol, minUsd }) => ({ id, chain, label, symbol, minUsd })),
      contacts: CONTACTS,
      treasury: cfg.treasury,
      payoutProvider: { name: payout.name, simulated: payout.simulated },
      fx: rate,
      fees: { platformFeeBps: cfg.platformFeeBps, fxSpreadBps: cfg.fxSpreadBps },
      benchmark: { costPct: cfg.benchmarkPct, source: 'World Bank Remittance Prices Worldwide, Q3 2025, Sub-Saharan Africa average (USD 200)' },
      limits: cfg.limits,
      llm: !!cfg.llm,
    });
  }));

  const QuoteBody = z.object({ amount: z.number().positive().max(100_000), currency: z.enum(['USD', 'GHS']).default('USD'), originId: z.string() });
  app.post('/api/quote', wrap(async (req, res) => {
    const b = QuoteBody.parse(req.body);
    const origin = findOrigin(b.originId);
    if (!origin) throw new HttpError(404, 'Unknown origin');
    let usd = b.amount;
    if (b.currency === 'GHS') usd = b.amount / (await fx.ghsPerUsd()).ghsPerUsd;
    usd = Math.round(usd * 100) / 100;
    if (usd < origin.minUsd) throw new HttpError(422, `${origin.label} ${origin.symbol} needs at least $${origin.minUsd} right now (NEAR Intents temporary swap limit)`);
    res.json(await quotes.create(origin, usd, { dry: true }));
  }));

  app.post('/api/agent/parse', wrap(async (req, res) => {
    const { text } = z.object({ text: z.string().min(1).max(500) }).parse(req.body);
    res.json(await parseWithLlm(text, cfg, fetchFn));
  }));

  const TransferBody = z.object({
    quoteId: z.string(), contactId: z.string().optional(), phone: z.string().max(30).optional(), name: z.string().max(60).optional(),
    purpose: z.string().max(60).optional(), initiatedBy: z.enum(['human', 'agent']).optional(), agentFlagged: z.boolean().optional(),
    refundTo: z.string().max(120).optional(),
  });
  app.post('/api/transfers', wrap(async (req, res) => {
    const t = await transfers.create(TransferBody.parse(req.body));
    res.status(201).json(transfers.view(t));
  }));
  app.get('/api/transfers', (_req, res) => res.json({ totals: transfers.totals(), transfers: transfers.list().map((t) => transfers.view(t)) }));
  app.get('/api/transfers/:id', wrap(async (req, res) => {
    const t = await transfers.advance(String(req.params.id));
    res.json(transfers.view(t));
  }));
  app.post('/api/transfers/:id/approve', (req, res) => res.json(transfers.view(transfers.approve(String(req.params.id)))));
  app.post('/api/transfers/:id/cancel', (req, res) => res.json(transfers.view(transfers.cancel(String(req.params.id)))));

  app.get('/api/ledger', (_req, res) => res.json({ verify: ledger.verify(), entries: ledger.all().slice(-60).reverse() }));

  app.get('/api/ops/summary', wrap(async (_req, res) => {
    const [treasury, rate] = await Promise.all([near.treasury(cfg.treasury, cfg.usdcContract), fx.ghsPerUsd()]);
    res.json({
      mode: cfg.mode, treasury, fx: rate, payoutProvider: { name: payout.name, simulated: payout.simulated },
      totals: transfers.totals(), limits: cfg.limits, ledger: ledger.verify(),
    });
  }));

  app.get('/api/near/account/:id', wrap(async (req, res) => {
    const id = String(req.params.id).toLowerCase();
    if (!isValidNearAccount(id)) throw new HttpError(422, 'Not a valid NEAR account id');
    res.json(await near.treasury(id, cfg.usdcContract));
  }));

  if (cfg.webDir && existsSync(join(cfg.webDir, 'index.html'))) {
    app.use(express.static(cfg.webDir));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(cfg.webDir!, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) return void res.status(400).json({ error: 'Invalid request', issues: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
    if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message, ...err.extra });
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  });

  return { app, cfg, ledger, transfers, quotes, snapshot };
}
