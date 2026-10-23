# Submission pack: SikaSend

> DRAFT. Nothing has been submitted or posted. Rufus reviews, records the video, and submits.

## Form fields (nearhackathon.com, opens 1 Nov 2026 00:00 UTC)

| Field | Value |
|---|---|
| Project title | SikaSend |
| Tracks (select all that fit) | **Real-World Money** (primary), **AI Security & Defense**, **Agent Economy** |
| NEAR wallet address | *Rufus to supply, the prize is sent here. `npm run treasury:keygen` can make a fresh one, but use a wallet you control and can recover* |
| Repository link | *public GitHub URL, to be created by Rufus* |
| Demo post link | *the X post URL after Rufus posts* |

## One-liner

An AI agent that turns dollars into Ghana mobile money over NEAR Intents, inside spending rules it can't break.

## Short description (about 300 characters)

SikaSend lets a diaspora sender say "send $200 to Auntie Akosua for school fees". An agent prices a real, signed NEAR Intents quote, checks it against limits it can't override, holds anything unusual for human approval, and pays out to MTN, Telecel or AirtelTigo mobile money at about 1.5% all-in vs 8.46% average.

## Long description

**The problem.** Remittances to Sub-Saharan Africa cost 8.46% on average for a $200 transfer (World Bank, Q3 2025). Ghana's diaspora sends billions a year, and recipients mostly collect through mobile money. Stablecoins are cheap, but the last mile is awkward, and nobody wants to hand an AI agent unlimited access to a bank account.

**What SikaSend does.** The sender tells an agent what she wants in plain language. The agent resolves who and how much, then requests a quote from the NEAR Intents 1Click API (stablecoin on Base, Ethereum, Arbitrum, Solana or Tron to USDC on NEAR) and verifies its ed25519 signature. The quote is converted to cedis at a live rate and shown with the all-in cost against the World Bank benchmark. A default-deny policy engine then decides: allow, hold for human approval, or block. If allowed, the agent tracks the swap, pays the recipient's MoMo number with an idempotent disbursement (retrying on gateway failure without ever double-paying), and writes every step to a hash-chained ledger.

**Why it fits the tracks.**
- *Real-World Money:* a concrete remittance rail on stablecoins and NEAR Intents that a normal company or family could use tomorrow.
- *AI Security & Defense:* spending limits, a policy engine, human-approval holds that the agent can't approve itself, a prompt-injection screen on the agent's input, quote-signature enforcement, and a tamper-evident audit log.
- *Agent Economy:* an agent that spends and moves value across chains through NEAR Intents, on a leash.

**What's real.** Live signed quotes from NEAR Intents (signature verified, tampering rejected in tests), live FX, live NEAR RPC treasury reads, the policy engine, approvals, injection screen, idempotent retry and the ledger, covered by 47 tests.

**What's simulated, and labelled as such in the UI.** The sender's deposit and swap fill (Intents has no testnet, so demo mode never touches funds) and the MoMo payout (a real rail needs a licensed aggregator). The people and phone numbers are fictional.

**What's next.** A real MoMo aggregator adapter behind the `PayoutProvider` interface, a non-custodial treasury using NEAR chain signatures or function-call keys so the agent can never exceed an on-chain allowance, anchoring the ledger head to a NEAR contract, and WhatsApp as the chat surface.

## X post draft

> Sending $200 to Ghana costs ~8.5% on average and takes days.
>
> Built SikaSend at NEAR HACKATHON: tell an agent "send $200 to Auntie Akosua for school fees". It gets a real signed @near_intents quote, checks limits it can't override, pauses for approval when something looks off, and pays out to MoMo. ~1.5% all-in.
>
> MoMo payout simulated in the demo. Quotes, signatures, policy engine real.
>
> Repo: <repo link>
> #NEARHACKATHON

*(Check the official hashtag and handles on the hackathon page before posting. Attach the demo video, or `screenshots/05-paid.png` and `screenshots/06-ops.png`. The event asks the post to say it was built at NEAR HACKATHON.)*

## Repo checklist before submitting

- [ ] Repo is **public** (judges can't open a private one)
- [ ] Substantial commits dated **1 to 14 Nov 2026** (see NEXT_STEPS.md, the rule says build during the hackathon)
- [ ] `README.md` honest-limits section intact, demo/simulated labels untouched
- [ ] No secrets committed: `git log -p | grep -iE "secret|api_key|ed25519:"` finds nothing sensitive; `.env` is ignored
- [ ] `npm install && npm test && npm run build && npm start` works from a fresh clone
- [ ] Screenshots in `screenshots/` are current
- [ ] Demo video recorded, uploaded to the X post
- [ ] X post says it was built at NEAR HACKATHON and links the repo
- [ ] Submission form filled with wallet, repo link, post link, tracks. **Rufus confirms the exact values before anything is sent**
