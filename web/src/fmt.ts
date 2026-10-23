export const usd = (n: number, d = 2) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const ghs = (n: number, d = 2) => 'GH₵' + n.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (n: number, d = 2) => n.toFixed(d) + '%';
export const short = (s: string, a = 6, b = 4) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);
export const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');
export const firstName = (n: string) => n.replace(/^(auntie|aunty|uncle|mr|mrs|ms)\.?\s+/i, '').split(' ')[0] ?? n;
