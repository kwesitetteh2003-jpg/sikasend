import { useEffect, useRef, useState } from 'react';

export function useHashRoute() {
  const [h, setH] = useState(() => location.hash || '#/');
  useEffect(() => { const f = () => setH(location.hash || '#/'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
}

export const go = (h: string) => { location.hash = h; scrollTo({ top: 0, behavior: 'smooth' }); };

/** Poll `fn` every `ms` until `stop(result)` is true. */
export function usePoll<T>(fn: () => Promise<T>, ms: number, deps: unknown[], stop?: (v: T) => boolean) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn); fnRef.current = fn;
  useEffect(() => {
    let alive = true; let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try { const v = await fnRef.current(); if (!alive) return; setData(v); setError(null); if (stop?.(v)) return; }
      catch (e) { if (alive) setError(e instanceof Error ? e.message : 'failed'); }
      if (alive) timer = setTimeout(tick, ms);
    };
    void tick();
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, setData };
}

export function useCountdown(iso?: string) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!iso) return;
    const t = () => setLeft(Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 1000)));
    t(); const i = setInterval(t, 1000); return () => clearInterval(i);
  }, [iso]);
  return left;
}
