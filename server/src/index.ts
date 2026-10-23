import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = loadConfig();
const guess = join(here, '..', '..', 'web', 'dist');
if (!cfg.webDir && existsSync(guess)) cfg.webDir = guess;

if (cfg.mode === 'live') console.warn('[sikasend] LIVE mode: real NEAR Intents quotes with deposit addresses. Payout rail is still simulated unless you add a real provider.');
const { app } = createApp({ cfg });
app.listen(cfg.port, '127.0.0.1', () => {
  console.log(`[sikasend] ${cfg.mode} mode on http://127.0.0.1:${cfg.port}${cfg.webDir ? '' : ' (API only; run the web dev server)'}`);
});
