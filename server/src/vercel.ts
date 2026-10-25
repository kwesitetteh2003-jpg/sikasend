// Vercel serverless entry: the same API as index.ts, without app.listen().
//
// Demo mode keeps no server-side state. Every visitor's quotes, transfers and ledger travel with their
// requests as a signed session token (see session.ts): the browser posts { method, path, body, session }
// to /api/__session, we rebuild the services from that token, run the normal Express route, and return
// { data, session }. Any instance can serve any request, so parallel or load-balanced calls never 404.
import type { IncomingMessage, ServerResponse } from 'node:http';
import express from 'express';
import { createApp } from './app.js';
import { loadConfig, type Config } from './config.js';
import { FxService } from './fx.js';
import { sign, verify } from './session.js';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let cfg: Config | undefined;
let shared: Handler | undefined;
let fx: FxService | undefined;

function readJson(req: IncomingMessage, limit = 2_500_000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => { size += c.length; if (size > limit) { reject(new Error('session too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}

async function session(c: Config, secret: string, req: IncomingMessage, res: ServerResponse) {
  const send = (code: number, body: unknown) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-sika-session', 'on');
    res.end(JSON.stringify(body));
  };
  let env: Record<string, unknown>;
  try { env = await readJson(req); } catch (e) { return send(400, { data: { error: (e as Error).message } }); }
  const method = String(env.method ?? 'GET').toUpperCase();
  const path = String(env.path ?? '');
  if (!['GET', 'POST'].includes(method) || !path.startsWith('/api/') || path.startsWith('/api/__session')) return send(400, { data: { error: 'bad envelope' } });

  const restored = verify(typeof env.session === 'string' ? env.session : undefined, secret);
  const built = createApp({ cfg: c, fx: (fx ??= new FxService((u, i) => fetch(u, i))), session: restored ?? { v: 1 } });
  const outer = express();
  outer.use((_q, r, next) => {
    const json = r.json.bind(r);
    r.json = (b: unknown) => {
      r.setHeader('x-sika-session', 'on');
      r.setHeader('cache-control', 'no-store');
      return json({ data: b, session: sign(built.snapshot(), secret), fresh: !restored });
    };
    next();
  });
  outer.use(built.app);
  outer.use((_q, r) => { r.status(404).json({ error: 'Not found' }); });

  const q = req as IncomingMessage & { body?: unknown; _body?: boolean };
  q.method = method;
  q.url = path;
  q.body = env.body ?? {};
  q._body = true;
  delete q.headers['content-length'];
  (outer as unknown as Handler)(q, res);
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const c = (cfg ??= loadConfig());
  const secret = process.env.SIKASEND_SESSION_SECRET;
  if (c.mode === 'demo' && secret && secret.length >= 32 && req.method === 'POST' && req.url?.split('?')[0] === '/api/__session' && req.headers['x-sika-envelope'] === '1') {
    void session(c, secret, req, res);
    return;
  }
  (shared ??= createApp({ cfg: c }).app as unknown as Handler)(req, res);
}
