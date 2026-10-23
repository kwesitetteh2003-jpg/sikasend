import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { api } from './api';
import { Header } from './components/Header';
import { Ops } from './components/Ops';
import { Send } from './components/Send';
import { Tracker } from './components/Tracker';
import { useHashRoute } from './hooks';
import type { AppConfig } from './types';

export function App() {
  const hash = useHashRoute();
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.config().then(setCfg).catch((e) => setErr(e.message)); }, []);

  const m = hash.match(/^#\/t\/([\w-]+)/);
  const view = hash.startsWith('#/ops') ? 'ops' : m ? 'track' : 'send';

  return (
    <>
      <div className="bg-stage" /><div className="bg-grid" />
      <Header mode={cfg?.mode} view={view} />
      <main className="mx-auto w-full max-w-[1180px] px-5 pb-24 pt-8 sm:px-8">
        {err && <div className="glass rounded-2xl p-6 text-ember">Cannot reach the SikaSend server: {err}</div>}
        {!err && !cfg && <div className="skeleton h-96 w-full" />}
        {cfg && (
          <AnimatePresence mode="wait">
            <motion.div key={view + (m?.[1] ?? '')} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
              {view === 'send' && <Send cfg={cfg} />}
              {view === 'track' && m?.[1] && <Tracker id={m[1]} cfg={cfg} />}
              {view === 'ops' && <Ops cfg={cfg} />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <Footer cfg={cfg} />
    </>
  );
}

function Footer({ cfg }: { cfg: AppConfig | null }) {
  return (
    <footer className="hairline mx-auto max-w-[1180px] border-t px-5 py-8 text-[12px] leading-relaxed text-ink-400 sm:px-8">
      <p className="max-w-3xl">
        {cfg?.mode === 'live'
          ? 'Live mode: swaps run through NEAR Intents on mainnet. The MoMo payout rail still depends on the configured provider.'
          : 'Demo mode. Quotes, signature checks, FX and the treasury balance are real NEAR Intents / NEAR RPC calls. The sender deposit, the swap fill and the MoMo payout are simulated and no money moves. The people and phone numbers are fictional.'}
      </p>
      <p className="mt-2 text-ink-500">SikaSend is a hackathon prototype for the NEAR Hackathon. Not a licensed money transmitter.</p>
    </footer>
  );
}
