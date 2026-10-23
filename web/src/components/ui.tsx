import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { cx } from '../fmt';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('glass rounded-3xl', className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('eyebrow', className)}>{children}</div>;
}

/** Smoothly tweens between numeric values. */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => { const c = animate(mv, value, { duration: 0.7, ease: [0.16, 1, 0.3, 1] }); return () => c.stop(); }, [value, mv]);
  return <motion.span className="num">{text}</motion.span>;
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'mint' | 'ember' | 'sky' }) {
  const t = { neutral: 'border-white/10 bg-white/[.04] text-ink-300', gold: 'border-gold/30 bg-gold/10 text-gold', mint: 'border-mint/30 bg-mint/10 text-mint', ember: 'border-ember/30 bg-ember/10 text-ember', sky: 'border-sky/30 bg-sky/10 text-sky' }[tone];
  return <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider', t)}>{children}</span>;
}

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-semibold text-ink-950" style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 55%, #000))`, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

export const Check = ({ ok, warn }: { ok?: boolean; warn?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0" aria-hidden>
    <circle cx="8" cy="8" r="7.25" fill={warn ? 'rgba(247,201,72,.12)' : ok ? 'rgba(47,212,127,.14)' : 'rgba(255,92,92,.14)'} stroke={warn ? '#f7c948' : ok ? '#2fd47f' : '#ff5c5c'} strokeWidth="1" />
    {warn ? <path d="M8 4.5v4M8 10.6v.1" stroke="#f7c948" strokeWidth="1.5" strokeLinecap="round" /> : ok ? <path d="M5 8.2l2 2L11 6" stroke="#2fd47f" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke="#ff5c5c" strokeWidth="1.5" strokeLinecap="round" />}
  </svg>
);

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />;
}
