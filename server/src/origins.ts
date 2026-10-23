/**
 * Origin corridors the sender can fund from. Asset ids are NEAR Intents defuse asset ids, taken
 * from GET /v0/tokens (verified live). A placeholder refund address is used only for dry quotes.
 */
export interface Origin {
  id: string;
  chain: string;
  label: string;
  symbol: 'USDC' | 'USDT';
  assetId: string;
  decimals: number;
  dryRefundTo: string;
  addressHint: string;
  /** Smallest amount NEAR Intents currently quotes for this origin (observed 2026-10-23). */
  minUsd: number;
}

const EVM_DRY = '0x2527D02599Ba641c19FEa793cD0F167589a0f10D';

export const ORIGINS: Origin[] = [
  { id: 'base-usdc', chain: 'base', label: 'Base', symbol: 'USDC', assetId: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near', decimals: 6, dryRefundTo: EVM_DRY, addressHint: '0x…', minUsd: 1 },
  { id: 'eth-usdc', chain: 'eth', label: 'Ethereum', symbol: 'USDC', assetId: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near', decimals: 6, dryRefundTo: EVM_DRY, addressHint: '0x…', minUsd: 1 },
  { id: 'arb-usdc', chain: 'arb', label: 'Arbitrum', symbol: 'USDC', assetId: 'nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near', decimals: 6, dryRefundTo: EVM_DRY, addressHint: '0x…', minUsd: 1 },
  { id: 'sol-usdc', chain: 'sol', label: 'Solana', symbol: 'USDC', assetId: 'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near', decimals: 6, dryRefundTo: 'So11111111111111111111111111111111111111112', addressHint: 'Base58…', minUsd: 1 },
  { id: 'tron-usdt', chain: 'tron', label: 'Tron', symbol: 'USDT', assetId: 'nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near', decimals: 6, dryRefundTo: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb', addressHint: 'T…', minUsd: 101 },
];

export const findOrigin = (id: string) => ORIGINS.find((o) => o.id === id);
