import { describe, expect, it } from "vitest";
import {
  markHomerunTierDone,
  originalFractionToRemainingFraction,
  planHomerunExit,
  updatePeakPnl,
} from "./homerun-exits";
import type { BotConfig, Position } from "./types";

const baseConfig: BotConfig = {
  tradeSizeSol: 0.05,
  copySizeMode: "conviction",
  referenceConvictionPct: 0.1,
  minCopyTradeSol: 0.02,
  maxCopyTradeSol: 0.08,
  maxOpenPositions: 2,
  stopLossPct: 0,
  takeProfitPct: 0,
  minLiquidityUsd: 2000,
  minTokenAgeHours: 0,
  slippageBps: 300,
  maxBuyPriceImpactPct: 50,
  targetAutoDisableMinTrades: 3,
  targetAutoDisableMaxLossSol: -0.05,
  minTargetConvictionPct: 0.02,
  homerunTiersEnabled: true,
  homerunTier1PnlPct: 100,
  homerunTier1SellFraction: 0.5,
  homerunTier2PnlPct: 400,
  homerunTier2SellOriginalFraction: 0.25,
  homerunTrailingStopPct: 20,
  targets: [],
};

function position(overrides: Partial<Position> = {}): Position {
  return {
    id: "p1",
    mint: "mint",
    status: "open",
    entrySol: 0.05,
    openedAt: new Date().toISOString(),
    sourceWallet: "wallet",
    ...overrides,
  };
}

describe("homerun-exits", () => {
  it("originalFractionToRemainingFraction berekent restfractie", () => {
    expect(originalFractionToRemainingFraction(0.5, 0)).toBe(0.5);
    expect(originalFractionToRemainingFraction(0.25, 0.5)).toBeCloseTo(0.5);
  });

  it("tier1 triggert bij +100% PnL", () => {
    const action = planHomerunExit(position(), 100, baseConfig);
    expect(action.kind).toBe("tier1");
    if (action.kind === "tier1") {
      expect(action.sellFractionOfRemaining).toBe(0.5);
    }
  });

  it("tier2 triggert na tier1 bij +400%", () => {
    const pos = position({ homerunTier1Done: true });
    const action = planHomerunExit(pos, 400, baseConfig);
    expect(action.kind).toBe("tier2");
  });

  it("trailing stop na tier1 bij drawdown van peak", () => {
    const pos = position({ homerunTier1Done: true, peakPnlPct: 150 });
    const action = planHomerunExit(pos, 125, baseConfig);
    expect(action.kind).toBe("trailing_stop");
  });

  it("markHomerunTierDone zet flags", () => {
    const pos = position();
    markHomerunTierDone(pos, {
      kind: "tier1",
      sellFractionOfRemaining: 0.5,
      label: "t1",
    });
    expect(pos.homerunTier1Done).toBe(true);
  });

  it("updatePeakPnl houdt hoogste waarde", () => {
    const pos = position({ peakPnlPct: 50 });
    updatePeakPnl(pos, 40);
    expect(pos.peakPnlPct).toBe(50);
    updatePeakPnl(pos, 80);
    expect(pos.peakPnlPct).toBe(80);
  });
});
