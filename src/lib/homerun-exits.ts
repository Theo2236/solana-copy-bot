import type { BotConfig, Position } from "./types";

export type HomerunAction =
  | { kind: "none" }
  | { kind: "tier1"; sellFractionOfRemaining: number; label: string }
  | { kind: "tier2"; sellFractionOfRemaining: number; label: string }
  | { kind: "trailing_stop"; sellFractionOfRemaining: 1; label: string };

/** Verkoopfractie t.o.v. resterende positie als tier een % van oorspronkelijke positie verkoopt. */
export function originalFractionToRemainingFraction(
  originalFraction: number,
  alreadySoldOriginalFraction: number,
): number {
  const remainingOriginal = 1 - alreadySoldOriginalFraction;
  if (remainingOriginal <= 0) return 1;
  return Math.min(1, originalFraction / remainingOriginal);
}

/**
 * Bepaalt de volgende homerun-actie op basis van live PnL%.
 * Alleen winst-exits — verlies gaat uitsluitend via target copy-sell.
 */
export function planHomerunExit(
  position: Position,
  pnlPct: number,
  config: BotConfig,
): HomerunAction {
  if (!config.homerunTiersEnabled) {
    return { kind: "none" };
  }

  const tier1Done = position.homerunTier1Done === true;
  const tier2Done = position.homerunTier2Done === true;
  const peak = position.peakPnlPct ?? pnlPct;

  if (
    !tier1Done &&
    config.homerunTier1PnlPct > 0 &&
    pnlPct >= config.homerunTier1PnlPct
  ) {
    return {
      kind: "tier1",
      sellFractionOfRemaining: config.homerunTier1SellFraction,
      label: `Homerun tier 1 (+${config.homerunTier1PnlPct}%): ${(config.homerunTier1SellFraction * 100).toFixed(0)}% verkocht — inleg terug`,
    };
  }

  if (
    tier1Done &&
    !tier2Done &&
    config.homerunTier2PnlPct > 0 &&
    pnlPct >= config.homerunTier2PnlPct
  ) {
    const soldOriginal = config.homerunTier1SellFraction;
    const sellOfRemaining = originalFractionToRemainingFraction(
      config.homerunTier2SellOriginalFraction,
      soldOriginal,
    );
    return {
      kind: "tier2",
      sellFractionOfRemaining: sellOfRemaining,
      label: `Homerun tier 2 (+${config.homerunTier2PnlPct}%): winst vastgezet`,
    };
  }

  if (
    tier1Done &&
    config.homerunTrailingStopPct > 0 &&
    peak - pnlPct >= config.homerunTrailingStopPct
  ) {
    return {
      kind: "trailing_stop",
      sellFractionOfRemaining: 1,
      label: `Homerun trailing stop (peak ${peak.toFixed(0)}% → ${pnlPct.toFixed(0)}%)`,
    };
  }

  return { kind: "none" };
}

export function markHomerunTierDone(
  position: Position,
  action: HomerunAction,
): void {
  if (action.kind === "tier1") {
    position.homerunTier1Done = true;
  } else if (action.kind === "tier2") {
    position.homerunTier2Done = true;
  }
}

export function updatePeakPnl(position: Position, pnlPct: number): void {
  if (!Number.isFinite(pnlPct)) return;
  const prev = position.peakPnlPct;
  position.peakPnlPct =
    prev === undefined || pnlPct > prev ? pnlPct : prev;
}
