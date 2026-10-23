import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { api } from '../api';
import { clock, cx, firstName, ghs, short, usd } from '../fmt';
import { usePoll } from '../hooks';
import type { AppConfig, Transfer } from '../types';
import { Card, Check, Chip, Eyebrow, Spinner } from './ui';
import { RouteViz } from './RouteViz';
import { statusLabel, statusTone } from './Recent';

const TERMINAL = ['paid', 'refunded', 'failed', 'cancelled'];

export function Tracker({ id, cfg }: { id: string; cfg: AppConfig }) {
  const { data: t, error, setData } = usePoll(() => api.transfer(id), 1000, [id], (v) => TERMINAL.includes(v.status));
  const [busy, setBusy] = useState(false);
  if (!t) return error ? <Card className="p-8 text-ember">Transfer not found: {error}. The demo server keeps transfers in memory, so a restart clears them. <a href="#/" className="underline">Back</a></Card> : <div className="skeleton h-96" />;

  const act = async (fn: (id: string) => Promise<Transfer>) => { setBusy(true); try { setData(await fn(t.id)); } finally { setBusy(false); } };
  const paid = t.status === 'paid';
  const first = firstName(t.recipient.name);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <a href="#/" className="font-mono text-[12px] text-ink-400 hover:text-ink-200">← New transfer</a>
          <h2 className="mt-2 text-[34px] font-semibold tracking-tight sm:text-[44px]">
            {usd(t.quote.inputUsd)} <span className="text-ink-500">→</span> <span className="text-gold">{ghs(t.quote.ghsOut)}</span>
          </h2>
          <p className="mt-1 text-[14px] text-ink-400">{cfg.sender.name} to {t.recipient.name}{t.purpose ? ` · ${t.purpose}` : ''} · {t.initiatedBy === 'agent' ? 'prepared by the agent' : 'sent by you'}</p>
        </div>
        <div className="flex items-center gap-2">
          {t.mode === 'demo' && <Chip tone="gold">simulated settlement</Chip>}
          <Chip tone={statusTone(t.status)}>{statusLabel(t.status)}</Chip>
        </div>
      </div>

      <AnimatePresence>
        {t.status === 'held' && (
          <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, height: 0 }} className="rounded-3xl border border-gold/35 bg-gradient-to-br from-gold/[.12] to-gold/[.03] p-6">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="max-w-xl">
                <Eyebrow className="!text-gold">Held for your approval</Eyebrow>
                <p className="mt-2 text-[18px] font-medium leading-snug">The agent stopped before moving money.</p>
                <ul className="mt-2 space-y-1 text-[14px] text-ink-200">
                  {t.policy.reviewReasons.map((r) => <li key={r}>• {r}</li>)}
                </ul>
                <p className="mt-3 text-[13px] text-ink-300">Check that <b>{t.recipient.name}</b> and <span className="font-mono">{t.recipient.phone}</span> are right. Nothing was sent. The agent cannot approve its own hold.</p>
              </div>
              <div className="flex gap-3">
                <button disabled={busy} onClick={() => act(api.cancel)} className="h-12 rounded-xl border border-white/15 px-5 text-[14px] text-ink-200 transition hover:bg-white/5 disabled:opacity-40">Decline</button>
                <button disabled={busy} onClick={() => act(api.approve)} className="flex h-12 items-center gap-2 rounded-xl bg-gold px-6 text-[14px] font-semibold text-ink-950 transition hover:brightness-110 disabled:opacity-40">{busy ? <Spinner /> : 'Approve and send'}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="px-4 pb-4 pt-6 sm:px-8">
        <RouteViz status={t.status} from={{ title: (cfg.sender.name.split(' ')[0] ?? '') + "'s wallet", sub: `${t.quote.origin.symbol} · ${t.quote.origin.label}` }} to={{ title: first, sub: t.recipient.network }} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <Card className="p-6">
          <Eyebrow>Progress</Eyebrow>
          <ol className="mt-5">
            {t.steps.map((s, i) => (
              <motion.li key={s.key} layout className="relative flex gap-4 pb-6 last:pb-0">
                {i < t.steps.length - 1 && <span className="absolute left-[11px] top-6 h-full w-px bg-white/10"><motion.span className="block w-full bg-gradient-to-b from-mint to-mint/20" initial={false} animate={{ height: s.state === 'done' ? '100%' : '0%' }} transition={{ duration: 0.6 }} /></span>}
                <span className="relative mt-0.5 grid h-6 w-6 shrink-0 place-items-center">
                  {s.state === 'done' ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}><Check ok /></motion.span>
                    : s.state === 'active' ? <span className="relative grid h-6 w-6 place-items-center"><span className="absolute h-6 w-6 animate-ping rounded-full bg-gold/30" /><span className="h-2.5 w-2.5 rounded-full bg-gold" /></span>
                    : <span className="h-2.5 w-2.5 rounded-full border border-white/20" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={cx('text-[15px] font-medium', s.state === 'pending' ? 'text-ink-500' : 'text-ink-100')}>{s.label}</div>
                  <div className={cx('text-[12.5px]', s.sub.startsWith('retrying') ? 'text-gold' : 'text-ink-500')}>{s.sub}</div>
                </div>
                {s.at && <span className="font-mono text-[11px] text-ink-500">{clock(s.at)}</span>}
              </motion.li>
            ))}
          </ol>
          {t.status === 'awaiting_deposit' && t.mode === 'live' && t.quote.depositAddress && (
            <div className="mt-4 rounded-xl border border-gold/30 bg-gold/[.06] p-4 text-[13px]">
              Send exactly <b>{usd(t.quote.inputUsd)} {t.quote.origin.symbol}</b> on <b>{t.quote.origin.label}</b> to <span className="break-all font-mono">{t.quote.depositAddress}</span>
            </div>
          )}
          {['failed', 'refunded', 'cancelled'].includes(t.status) && <div className="mt-4 rounded-xl border border-ember/30 bg-ember/[.07] p-4 text-[13px] text-ember">{t.note ?? `Transfer ${t.status}.`}</div>}
        </Card>

        <div className="space-y-6">
          <AnimatePresence>
            {paid && (
              <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 22 }} className="relative overflow-hidden rounded-3xl border border-mint/30 bg-gradient-to-br from-mint/[.14] to-transparent p-6">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-mint/20 blur-3xl" />
                <Eyebrow className="!text-mint">{first}'s phone · simulated SMS</Eyebrow>
                <div className="mt-3 max-w-[290px] rounded-2xl rounded-tl-md bg-ink-800 p-4 text-[14px] leading-snug shadow-xl">
                  Payment received for <b>{ghs(t.quote.ghsOut)}</b> from <b>{cfg.sender.name}</b>. Ref {t.payout?.ref ?? short(t.id, 8, 0)}. Current balance updated.
                  <div className="mt-2 text-[11px] text-ink-500">{t.recipient.network} · {t.recipient.phone}</div>
                </div>
                <p className="mt-4 text-[13px] text-ink-200">{ghs(t.quote.benchmark.savingsGhs)} more than at the average remittance cost. Payout provider: <span className="font-mono">{t.payout?.provider}</span>.</p>
              </motion.div>
            )}
          </AnimatePresence>

          <Card className="p-6">
            <Eyebrow>Policy checks</Eyebrow>
            <ul className="mt-3 space-y-2">
              {t.policy.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5 text-[13px]">
                  <span className="mt-0.5"><Check ok={c.status === 'pass'} warn={c.status === 'review'} /></span>
                  <span className="text-ink-200">{c.label}<span className="block text-[12px] text-ink-500">{c.detail}</span></span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between"><Eyebrow>Audit trail</Eyebrow><Chip tone="sky">hash-chained</Chip></div>
            <ul className="mt-3 space-y-1.5 font-mono text-[11.5px]">
              {t.ledger.map((e) => (
                <motion.li key={e.seq} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 text-ink-400">
                  <span className="w-[62px] text-ink-500">{clock(e.at)}</span>
                  <span className="w-[120px] truncate text-ink-200">{e.kind}</span>
                  <span className="text-ink-600">{short(e.hash, 8, 4)}</span>
                </motion.li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
