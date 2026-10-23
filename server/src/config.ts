export interface Config {
  port: number;
  mode: 'demo' | 'live';
  oneclickBase: string;
  oneclickJwt?: string;
  nearRpc: string;
  /** NEAR account that receives USDC from NEAR Intents and funds the MoMo payouts. */
  treasury: string;
  usdcContract: string;
  benchmarkPct: number;
  platformFeeBps: number;
  fxSpreadBps: number;
  demoSpeed: number;
  chaos: boolean;
  limits: Limits;
  llm?: { baseUrl: string; apiKey: string; model: string };
  webDir?: string;
}

export interface Limits {
  minUsd: number;
  perTransferUsd: number;
  dailyUsd: number;
  monthlyUsd: number;
  firstRecipientReviewUsd: number;
  agentAutoUsd: number;
  maxPerRecipientPerHour: number;
}

/**
 * Throwaway demo treasury: an implicit account derived from a key that was generated and
 * immediately discarded, so nobody can spend from it. Quotes only need a syntactically valid,
 * existing-or-implicit account. Replace with your own in .env (see `npm run treasury:keygen`).
 */
export const DEMO_TREASURY = '4537267fcbc987a570ee3a36b3694d470eb29cd106f632c44c706ae6e6dc1efb';

export const USDC_NEAR = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';

export const DEFAULT_LIMITS: Limits = {
  minUsd: 5,
  perTransferUsd: 1000,
  dailyUsd: 2000,
  monthlyUsd: 6000,
  firstRecipientReviewUsd: 250,
  agentAutoUsd: 150,
  maxPerRecipientPerHour: 3,
};

const num = (v: string | undefined, d: number) => {
  const n = v === undefined || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const mode = env.SIKASEND_MODE === 'live' ? 'live' : 'demo';
  const llm = env.LLM_BASE_URL && env.LLM_API_KEY
    ? { baseUrl: env.LLM_BASE_URL.replace(/\/$/, ''), apiKey: env.LLM_API_KEY, model: env.LLM_MODEL || 'gpt-4o-mini' }
    : undefined;
  return {
    port: num(env.PORT, 8910),
    mode,
    oneclickBase: (env.ONECLICK_BASE_URL || 'https://1click.chaindefuser.com').replace(/\/$/, ''),
    oneclickJwt: env.ONECLICK_JWT || undefined,
    nearRpc: env.NEAR_RPC_URL || 'https://free.rpc.fastnear.com',
    treasury: env.NEAR_TREASURY_ACCOUNT || DEMO_TREASURY,
    usdcContract: env.NEAR_USDC_CONTRACT || USDC_NEAR,
    benchmarkPct: num(env.BENCHMARK_COST_PCT, 8.46),
    platformFeeBps: num(env.PLATFORM_FEE_BPS, 50),
    fxSpreadBps: num(env.FX_SPREAD_BPS, 100),
    demoSpeed: Math.max(0.05, num(env.DEMO_SPEED, 1)),
    chaos: env.DEMO_CHAOS !== 'off',
    limits: {
      ...DEFAULT_LIMITS,
      perTransferUsd: num(env.LIMIT_PER_TRANSFER_USD, DEFAULT_LIMITS.perTransferUsd),
      dailyUsd: num(env.LIMIT_DAILY_USD, DEFAULT_LIMITS.dailyUsd),
      monthlyUsd: num(env.LIMIT_MONTHLY_USD, DEFAULT_LIMITS.monthlyUsd),
    },
    llm,
    webDir: env.WEB_DIR || undefined,
  };
}
