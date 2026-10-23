# Next steps for Rufus

All times are Accra (UTC+0, same as UTC). Nothing here has been done for you: no signups, posts, submissions or spending.

## Deadlines

| When (Accra) | What |
|---|---|
| Sun 1 Nov 2026, 00:00 | Hackathon starts, submissions open |
| **Sat 14 Nov 2026, 23:59** | **Development and submission deadline** |
| Mon 16 to Wed 18 Nov | Judging, results by 23:59 on the 18th |

## 0. Rule check (do first)

The site says **"Build your project during the hackathon."** This prototype was written on 23 Oct, before the window. Ask in the NEAR Discord whether pre-window scaffolding is acceptable. Either way, plan real work inside 1 to 14 Nov, with commits dated honestly in that window:

- Replace the simulated payout with a real MoMo sandbox adapter (e.g. a Ghana payments aggregator sandbox) behind `PayoutProvider`.
- Add a NEAR-side piece: anchor the ledger head hash in a small NEAR contract, or hold the treasury under a function-call key or chain signature policy so the on-chain account itself enforces the cap.
- Wire live mode end to end with a small mainnet test using your own funds ($5 to $10 on Base), and record the real deposit address, swap and USDC arrival.
- Persist state (SQLite) and add simple auth.
- Add the meta-transactions angle the Real-World Money track suggests (gasless USDC payout from the treasury).
- Polish UI, add a mobile-first flow, WhatsApp-style chat view for the agent.

## 1. Accounts and keys

- **GitHub:** create a public repo and push (see 2).
- **NEAR wallet:** use a wallet you control for the prize address. For the app treasury run `npm run treasury:keygen`, store the secret key in your password manager, put the account id in `.env` as `NEAR_TREASURY_ACCOUNT`.
- **NEAR Intents:** optional partner JWT as `ONECLICK_JWT`. Quotes work without it.
- **MoMo sandbox** (for the real payout): sign up with a Ghana-licensed aggregator, get sandbox keys.
- **LLM key** (optional): any OpenAI-compatible endpoint as `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.

## 2. Publish

```bash
cd /workspace/hackathon-projects/near-sikasend   # or the unzipped copy
git remote add origin https://github.com/<you>/sikasend.git
git push -u origin main
```

## 3. Deploy (optional but nice for judges)

Single Node service serving API and UI: `npm ci && npm run build && npm start`, `PORT` from the host, demo mode. Railway, Fly.io or Render all work. Keep `SIKASEND_MODE=demo` on any public URL. The server binds to 127.0.0.1 by default, so change the bind host in `server/src/index.ts` for a host that needs 0.0.0.0.

## 4. Record the demo

Follow `DEMO_SCRIPT.md` (2:30). Say "simulated" where the screen does.

## 5. Post on X

Use the draft in `SUBMISSION.md`. It has to say it was built at NEAR HACKATHON and attach the video or screenshots. Check the official hashtag and handles on the site. Post from your account.

## 6. Submit

Between 1 Nov 00:00 and 14 Nov 23:59 (Accra): fill the form with wallet, repo link, X post link, and tick Real-World Money, AI Security & Defense, Agent Economy. The site notes an AI agent can file the submission, but confirm the exact values yourself first.
