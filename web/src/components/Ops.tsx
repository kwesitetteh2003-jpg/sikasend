import { motion } from 'framer-motion';
import { api } from '../api';
import { clock, cx, ghs, short, usd } from '../fmt';
import { usePoll } from '../hooks';
import type { AppConfig } from '../types';
import { AnimatedNumber, Card, Check, Chip, Eyebrow } from './ui';
import { statusLabel, statusTone } from './Recent';

export function Ops({ cfg }: { cfg: AppConfig }) {
  const { data: ops } = usePoll(api.ops, 6000, []);
  const { data: led } = usePoll(api.ledger, 3000, []);
  const { data: list } = usePoll(api.transfers, 3000, []);
  const L = cfg.limits;
  const tr = ops?.treasury;

  const stat = (label: string, v: number, f: (n: number) => string, sub?: string) => (
    <Card className="p-5"><Eyebrow>{label}</Eyebrow><div className="mt-2 text-[30px] font-semibold tracking-tight"><AnimatedNumber value={v} format={f} /></div>{sub && <div className="mt-1 text-[12px] text-ink-500">{sub}</div>}</Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Operator view</Eyebrow>
        <h2 className="mt-2 text-[34px] font-semibold tracking-tight sm:text-[44px]">Ops console</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-400">What the person running the payout agent sees: treasury on NEAR, the limits the agent is bound by, and the tamper-evident ledger.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat('Transfers', ops?.totals.count ?? 0, (n) => Math.round(n).toString(), `${ops?.totals.paid ?? 0} paid · ${ops?.totals.held ?? 0} held`)}
        {stat('Volume paid', ops?.totals.volumeUsd ?? 0, (n) => usd(n, 0), 'USD in, this session')}
        {stat('Cedis delivered', ops?.totals.paidGhs ?? 0, (n) => ghs(n, 0), 'to mobile-money wallets')}
        {stat('Saved vs average cost', ops?.totals.savedGhs ?? 0, (n) => ghs(n, 0), 'World Bank RPW benchmark')}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between"><Eyebrow>Treasury · NEAR mainnet, live RPC read</Eyebrow>{tr && <Chip tone={tr.reachable ? 'mint' : 'ember'}>{tr.reachable ? 'rpc ok' : 'rpc down'}</Chip>}</div>
          <div className="mt-3 break-all font-mono text-[12.5px] text-ink-300">{cfg.treasury}</div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div><div className="text-[12px] text-ink-500">USDC (native)</div><div className="num mt-1 text-[28px] font-semibold">{tr?.usdcBalance ?? '…'}</div></div>
            <div><div className="text-[12px] text-ink-500">NEAR</div><div className="num mt-1 text-[28px] font-semibold">{tr?.nearBalance ?? '…'}</div></div>
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-500">
            {tr && !tr.exists ? 'This implicit account has not been created on chain yet (no deposit has ever landed). In demo mode that is expected. Set NEAR_TREASURY_ACCOUNT to your own wallet to see its real balance here.' : 'Balance read via view_account and ft_balance_of.'}
            {tr?.blockHeight ? ` Block ${tr.blockHeight.toLocaleString()}.` : ''}
          </p>
          <div className="mt-4 flex items-center gap-2 border-t border-white/[.06] pt-4 text-[12.5px] text-ink-300">
            Payout rail: <span className="font-mono">{cfg.payoutProvider.name}</span> {cfg.payoutProvider.simulated && <Chip tone="gold">simulated</Chip>}
          </div>
        </Card>

        <Card className="p-6">
          <Eyebrow>Agent guardrails · enforced server-side</Eyebrow>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
            {[
              ['Minimum', usd(L.minUsd, 0)], ['Per transfer', usd(L.perTransferUsd, 0)], ['Per 24 hours', usd(L.dailyUsd, 0)], ['Per 30 days', usd(L.monthlyUsd, 0)],
              ['Agent sends alone up to', usd(L.agentAutoUsd, 0)], ['New recipient review over', usd(L.firstRecipientReviewUsd, 0)], ['Max per recipient / hour', String(L.maxPerRecipientPerHour)], ['Quote signature', 'required'],
            ].map(([k, v]) => <div key={k}><dt className="text-ink-500">{k}</dt><dd className="num mt-0.5 text-[17px] font-medium text-ink-100">{v}</dd></div>)}
          </dl>
          <p className="mt-5 text-[12.5px] leading-relaxed text-ink-500">Default-deny. A failing check blocks, an unusual one holds for a human. The agent cannot approve its own hold or change these numbers.</p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>Ledger</Eyebrow>
          {led && <div className="flex items-center gap-2 text-[12px]"><Check ok={led.verify.ok} /> <span className={led.verify.ok ? 'text-mint' : 'text-ember'}>{led.verify.ok ? `chain intact · ${led.verify.length} entries` : 'CHAIN BROKEN'}</span><span className="font-mono text-ink-600">head {short(led.verify.head, 8, 6)}</span></div>}
        </div>
        <div className="scroll-thin mt-4 max-h-[340px] overflow-auto">
          <table className="w-full text-left font-mono text-[11.5px]">
            <thead className="text-ink-500"><tr><th className="pb-2 font-normal">#</th><th className="pb-2 font-normal">time</th><th className="pb-2 font-normal">event</th><th className="pb-2 font-normal">transfer</th><th className="pb-2 font-normal">prev</th><th className="pb-2 font-normal">hash</th></tr></thead>
            <tbody>
              {led?.entries.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-ink-500">No events yet. Send a transfer.</td></tr>}
              {led?.entries.map((e) => (
                <motion.tr key={e.seq} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-white/[.05] text-ink-400">
                  <td className="py-1.5 pr-3">{e.seq}</td><td className="pr-3">{clock(e.at)}</td><td className="pr-3 text-ink-200">{e.kind}</td><td className="pr-3">{short(e.transferId, 6, 0)}</td><td className="pr-3 text-ink-600">{short(e.prevHash, 6, 4)}</td><td className="text-sky">{short(e.hash, 6, 4)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {list && list.transfers.length > 0 && (
        <Card className="p-6">
          <Eyebrow>All transfers</Eyebrow>
          <div className="mt-3 divide-y divide-white/[.06]">
            {list.transfers.slice().reverse().map((t) => (
              <a key={t.id} href={`#/t/${t.id}`} className="flex items-center justify-between gap-3 py-3 text-[13px] hover:text-gold">
                <span className="truncate">{t.recipient.name} <span className="text-ink-500">· {usd(t.quote.inputUsd)} {t.quote.origin.symbol} · {t.initiatedBy}</span></span>
                <Chip tone={statusTone(t.status)}>{statusLabel(t.status)}</Chip>
              </a>
            ))}
          </div>
        </Card>
      )}
      <p className={cx('text-[12px] text-ink-600')}>FX {ops?.fx.source === 'live' ? 'live' : 'fallback'} · {ops?.fx.provider} · 1 USD = {ops?.fx.ghsPerUsd.toFixed(3)} GHS</p>
    </div>
  );
}
