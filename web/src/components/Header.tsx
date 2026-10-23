import { motion } from 'framer-motion';
import { cx } from '../fmt';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#0d0f13" stroke="rgba(255,255,255,.12)" />
      <path d="M8.5 21c0 2 2 3.5 5.5 3.5s5.2-1.5 5.2-3.4-2-3-5.4-3.8-5.4-2.3-5.4-4.4 2-4.4 5.4-4.4 5.4 1.2 5.4 3.4" fill="none" stroke="#f7c948" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="24.2" cy="8.4" r="2.4" fill="#2fd47f" />
    </svg>
  );
}

export function Header({ mode, view }: { mode?: 'demo' | 'live'; view: string }) {
  const tab = (href: string, label: string, active: boolean) => (
    <a href={href} className={cx('relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors', active ? 'text-ink-100' : 'text-ink-400 hover:text-ink-200')}>
      {active && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-full bg-white/[.07] ring-1 ring-white/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
      {label}
    </a>
  );
  return (
    <header className="sticky top-0 z-30 border-b border-white/[.06] bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5 sm:px-8">
        <a href="#/" className="flex items-center gap-3">
          <Logo />
          <span className="text-[17px] font-semibold tracking-tight">SikaSend</span>
        </a>
        <nav className="flex items-center gap-1">
          {tab('#/', 'Send', view === 'send' || view === 'track')}
          {tab('#/ops', 'Ops console', view === 'ops')}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          {mode && (
            <span className={cx('flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider', mode === 'demo' ? 'border-gold/30 bg-gold/10 text-gold' : 'border-mint/30 bg-mint/10 text-mint')}>
              <span className="relative flex h-1.5 w-1.5"><span className={cx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-70', mode === 'demo' ? 'bg-gold' : 'bg-mint')} /><span className={cx('relative inline-flex h-1.5 w-1.5 rounded-full', mode === 'demo' ? 'bg-gold' : 'bg-mint')} /></span>
              {mode === 'demo' ? 'Demo · simulated settlement' : 'Live'}
            </span>
          )}
          <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-ink-300">NEAR Intents</span>
        </div>
      </div>
    </header>
  );
}
