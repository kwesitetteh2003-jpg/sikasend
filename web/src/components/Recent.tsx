import { motion } from 'framer-motion';
import { api } from '../api';
import { ghs, usd } from '../fmt';
import { usePoll } from '../hooks';
import { Chip, Eyebrow } from './ui';
import type { Status } from '../types';

export const statusTone = (s: Status) => (s === 'paid' ? 'mint' : s === 'held' ? 'gold' : s === 'failed' || s === 'cancelled' || s === 'refunded' ? 'ember' : 'sky') as 'mint' | 'gold' | 'ember' | 'sky';
export const statusLabel = (s: Status) => s.replace(/_/g, ' ');

export function Recent() {
  const { data } = usePoll(api.transfers, 4000, []);
  if (!data || data.transfers.length === 0) return null;
  return (
    <div>
      <Eyebrow>This session</Eyebrow>
      <div className="mt-3 divide-y divide-white/[.06] overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.02]">
        {data.transfers.slice().reverse().slice(0, 5).map((t, i) => (
          <motion.a key={t.id} href={`#/t/${t.id}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] transition hover:bg-white/[.03]">
            <span className="truncate text-ink-200">{t.recipient.name} <span className="text-ink-500">· {usd(t.quote.inputUsd)} → {ghs(t.quote.ghsOut)}</span></span>
            <Chip tone={statusTone(t.status)}>{statusLabel(t.status)}</Chip>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
