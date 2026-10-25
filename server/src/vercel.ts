// Vercel serverless entry: the same API as index.ts, without app.listen().
// Demo state (transfers, ledger) lives in memory per function instance.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

let app: ((req: IncomingMessage, res: ServerResponse) => void) | undefined;
export default function handler(req: IncomingMessage, res: ServerResponse) {
  app ??= createApp({ cfg: loadConfig() }).app as unknown as (req: IncomingMessage, res: ServerResponse) => void;
  app(req, res);
}
