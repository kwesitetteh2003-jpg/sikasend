// Drives the running app in headless Chrome and saves screenshots to ./screenshots.
// Usage: npm run screenshot   (server must be running; BASE_URL and CHROME_PATH override defaults)
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8910';
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
mkdirSync('screenshots', { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1.5 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: `screenshots/${name}.png` });

await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => /receives/i.test(document.body.innerText) && /[\d,]+\.\d\d\s*\n?\s*on /i.test(document.body.innerText), { timeout: 20000 });
await wait(1500);
await shot('01-send');

// agent flow: $200 > agent allowance, so it is held for approval
await page.type('input[aria-label="Tell the agent what to send"]', 'Send $200 to Auntie Akosua for school fees');
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('needs your ok'), { timeout: 20000 });
await wait(1800);
await shot('02-agent-review');

const btn = await page.$$('button');
for (const b of btn) { const t = await b.evaluate((e) => e.textContent); if (t?.includes('Let the agent send')) { await b.click(); break; } }
await page.waitForFunction(() => location.hash.startsWith('#/t/') && document.body.innerText.toLowerCase().includes('held for your approval'), { timeout: 20000 });
await wait(1500);
await shot('03-held');

for (const b of await page.$$('button')) { const t = await b.evaluate((e) => e.textContent); if (t?.includes('Approve and send')) { await b.click(); break; } }
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('swap') || document.body.innerText.toLowerCase().includes('solvers fill'), { timeout: 20000 });
await wait(7500);
await shot('04-in-flight');
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('simulated sms'), { timeout: 40000 });
await wait(2200);
await shot('05-paid');

await page.goto(BASE + '/#/ops', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('chain intact'), { timeout: 20000 });
await wait(1500);
await shot('06-ops');

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(BASE + '/#/', { waitUntil: 'networkidle0' });
await wait(2500);
await page.screenshot({ path: 'screenshots/07-mobile.png', fullPage: false });

await browser.close();
if (errors.length) { console.error('Browser errors:\n' + errors.join('\n')); process.exit(1); }
console.log('ok: screenshots saved to ./screenshots');
