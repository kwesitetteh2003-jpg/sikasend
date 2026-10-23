import { animate, motion, useMotionValue } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { Status } from '../types';

const PATH = 'M80 110 Q240 14 400 110 Q560 206 720 110';
const PROGRESS: Record<Status, number> = { held: 0, awaiting_deposit: 0.03, deposit_detected: 0.2, swapping: 0.42, usdc_settled: 0.56, payout_pending: 0.8, paid: 1, refunded: 0.0, failed: 0.0, cancelled: 0 };

interface Props { status: Status; from: { title: string; sub: string }; to: { title: string; sub: string } }

export function RouteViz({ status, from, to }: Props) {
  const p = PROGRESS[status];
  const pathRef = useRef<SVGPathElement>(null);
  const dot = useRef<SVGGElement>(null);
  const prog = useMotionValue(0);

  useEffect(() => {
    const c = animate(prog, p, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [p, prog]);

  useEffect(() => {
    const place = (v: number) => {
      const path = pathRef.current; const d = dot.current; if (!path || !d) return;
      const pt = path.getPointAtLength(v * path.getTotalLength());
      d.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    };
    place(prog.get());
    return prog.on('change', place);
  }, [prog]);

  const reached = (n: 0 | 1 | 2) => (n === 0 ? true : n === 1 ? p >= 0.4 : status === 'paid');
  const failed = status === 'failed' || status === 'refunded' || status === 'cancelled';
  const nodes = [
    { x: 80, y: 110, t: from.title, s: from.sub, c: '#7aa2ff' },
    { x: 400, y: 110, t: 'NEAR Intents', s: 'swap · USDC on NEAR', c: '#f7c948' },
    { x: 720, y: 110, t: to.title, s: to.sub, c: '#2fd47f' },
  ] as const;

  return (
    <svg viewBox="0 36 800 176" className="w-full" role="img" aria-label={`Payment route, status ${status}`}>
      <defs>
        <linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#7aa2ff" /><stop offset=".5" stopColor="#f7c948" /><stop offset="1" stopColor="#2fd47f" /></linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <radialGradient id="halo"><stop offset="0" stopColor="#fff" stopOpacity=".5" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <path d={PATH} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
      <path ref={pathRef} d={PATH} fill="none" stroke="transparent" />
      <motion.path d={PATH} fill="none" stroke="url(#g)" strokeWidth="3" strokeLinecap="round" filter="url(#glow)" style={{ pathLength: prog }} opacity={failed ? 0.25 : 1} />

      {nodes.map((n, i) => {
        const on = reached(i as 0 | 1 | 2);
        const pulse = (i === 0 && status === 'awaiting_deposit') || (i === 1 && ['deposit_detected', 'swapping', 'usdc_settled'].includes(status)) || (i === 2 && status === 'payout_pending');
        return (
          <g key={n.t} transform={`translate(${n.x} ${n.y})`}>
            {pulse && <motion.circle r="26" fill="none" stroke={n.c} strokeWidth="1.5" initial={{ scale: 0.8, opacity: 0.8 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }} />}
            {i === 1 && ['swapping'].includes(status) && (
              <motion.g animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
                <circle r="34" fill="none" stroke={n.c} strokeOpacity=".5" strokeDasharray="6 10" />
              </motion.g>
            )}
            <motion.circle r="22" fill="#0b0d11" stroke={on ? n.c : 'rgba(255,255,255,.16)'} strokeWidth="2" animate={{ stroke: on ? n.c : 'rgba(255,255,255,.16)' }} />
            <motion.circle r="8" animate={{ fill: on ? n.c : 'rgba(255,255,255,.14)', scale: on ? 1 : 0.7 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} />
            <text y="52" textAnchor="middle" fill="#eceef3" fontSize="14" fontWeight="600" style={{ fontFamily: 'var(--font-sans)' }}>{n.t}</text>
            <text y="70" textAnchor="middle" fill="#6b7280" fontSize="11.5" style={{ fontFamily: 'var(--font-mono)' }}>{n.s}</text>
          </g>
        );
      })}

      <g ref={dot} opacity={failed ? 0 : 1}>
        <circle r="22" fill="url(#halo)" />
        <circle r="6.5" fill="#fff" filter="url(#glow)" />
      </g>
    </svg>
  );
}
