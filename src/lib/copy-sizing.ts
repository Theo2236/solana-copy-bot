import type { BotConfig, ParsedSwap } from "./types";
import { getWalletBalanceSol } from "./solana";

export type CopySizeMode = "fixed" | "conviction";

export interface CopyTradeSizeResult {
  tradeSol: number;
  mode: CopySizeMode;
  convictionPct: number | null;
  targetWalletSol: number | null;
  multiplier: number;
}

/**
 * Berekent hoeveel SOL we kopiëren op basis van hoe "hard" de target inzet.
 * Bij conviction: target koopt 50% van wallet → ~5× meer dan bij 10% (referentie).
 */
export async function computeCopyTradeSize(
  swap: ParsedSwap,
  config: BotConfig,
): Promise<CopyTradeSizeResult> {
  // Conviction-sizing werkt alleen voor SOL-gefunde buys. Bij stablecoin-gefunde
  // trades (solAmount = 0) kennen we de SOL-inzet niet, dus vaste grootte.
  if (
    config.copySizeMode !== "conviction" ||
    swap.side !== "buy" ||
    swap.solAmount <= 0
  ) {
    return {
      tradeSol: config.tradeSizeSol,
      mode: "fixed",
      convictionPct: null,
      targetWalletSol: null,
      multiplier: 1,
    };
  }

  const currentBalance = await getWalletBalanceSol(swap.wallet);
  const estimatedWalletBefore = currentBalance + swap.solAmount;

  if (!Number.isFinite(estimatedWalletBefore) || estimatedWalletBefore < 0.05) {
    return {
      tradeSol: clampTradeSol(config.tradeSizeSol, config),
      mode: "conviction",
      convictionPct: null,
      targetWalletSol: null,
      multiplier: 1,
    };
  }

  const convictionPct = swap.solAmount / estimatedWalletBefore;
  const reference = config.referenceConvictionPct;

  if (!Number.isFinite(reference) || reference <= 0) {
    return {
      tradeSol: clampTradeSol(config.tradeSizeSol, config),
      mode: "conviction",
      convictionPct,
      targetWalletSol: estimatedWalletBefore,
      multiplier: 1,
    };
  }

  const multiplier = convictionPct / reference;
  const scaled = config.tradeSizeSol * multiplier;

  return {
    tradeSol: clampTradeSol(scaled, config),
    mode: "conviction",
    convictionPct,
    targetWalletSol: estimatedWalletBefore,
    multiplier,
  };
}

function clampTradeSol(amount: number, config: BotConfig): number {
  const fallback = Number.isFinite(config.tradeSizeSol) ? config.tradeSizeSol : 0.05;
  const base = Number.isFinite(amount) ? amount : fallback;
  const min = Number.isFinite(config.minCopyTradeSol) ? config.minCopyTradeSol : 0.02;
  const max = Number.isFinite(config.maxCopyTradeSol) ? config.maxCopyTradeSol : fallback * 5;
  const clamped = Math.min(max, Math.max(min, base));
  return Math.round(clamped * 1_000_000) / 1_000_000;
}

export function formatConvictionPct(pct: number): string {
  return `${(pct * 100).toFixed(1)}%`;
}
