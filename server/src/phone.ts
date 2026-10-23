export type MomoNetwork = 'MTN MoMo' | 'Telecel Cash' | 'AirtelTigo Money';

// Ghana mobile prefixes (national format, after the leading 0).
const PREFIXES: Record<string, MomoNetwork> = {
  '24': 'MTN MoMo', '25': 'MTN MoMo', '53': 'MTN MoMo', '54': 'MTN MoMo', '55': 'MTN MoMo', '59': 'MTN MoMo',
  '20': 'Telecel Cash', '50': 'Telecel Cash',
  '26': 'AirtelTigo Money', '27': 'AirtelTigo Money', '56': 'AirtelTigo Money', '57': 'AirtelTigo Money',
};

export interface ParsedPhone { ok: boolean; msisdn?: string; display?: string; network?: MomoNetwork; reason?: string }

export function parseGhanaPhone(input: string): ParsedPhone {
  const digits = input.replace(/[\s\-().]/g, '');
  let national: string | undefined;
  if (/^\+233\d{9}$/.test(digits)) national = digits.slice(4);
  else if (/^233\d{9}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{9}$/.test(digits)) national = digits.slice(1);
  if (!national) return { ok: false, reason: 'Enter a Ghana mobile number like 024 412 3456 or +233 24 412 3456' };
  const network = PREFIXES[national.slice(0, 2)];
  if (!network) return { ok: false, reason: `Prefix 0${national.slice(0, 2)} is not a known Ghana mobile-money network` };
  return {
    ok: true,
    msisdn: `233${national}`,
    display: `+233 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`,
    network,
  };
}

export const maskPhone = (display: string) => display.replace(/(\+233 \d\d) \d{3}/, '$1 ***');
