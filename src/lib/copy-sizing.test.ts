import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeCopyTradeSize } from "./copy-sizing";
import type { BotConfig, ParsedSwap } from "./types";

vi.mock("./solana", () => ({
  getWalletBalanceSol: vi.fn(),
}));

import { getWalletBalanceSol } from "./solana";

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

const buySwap: ParsedSwap = {
  wallet: "wallet",
  side: "buy",
  mint: "mintpump",
  solAmount: 1,
  quote: "SOL",
  signature: "sig",
  timestamp: Date.now(),
};

describe("copy-sizing", () => {
  beforeEach(() => {
    vi.mocked(getWalletBalanceSol).mockReset();
  });

  it("gebruikt fixed size bij sell", async () => {
    const result = await computeCopyTradeSize(
      { ...buySwap, side: "sell" },
      baseConfig,
    );
    expect(result.mode).toBe("fixed");
    expect(result.tradeSol).toBe(0.05);
  });

  it("schaalt conviction bij hoge wallet-inzet", async () => {
    vi.mocked(getWalletBalanceSol).mockResolvedValue(4);
    const result = await computeCopyTradeSize(buySwap, baseConfig);
    expect(result.mode).toBe("conviction");
    expect(result.tradeSol).toBeGreaterThan(0.05);
    expect(result.tradeSol).toBeLessThanOrEqual(0.08);
  });

  it("clamp naar maxCopyTradeSol", async () => {
    vi.mocked(getWalletBalanceSol).mockResolvedValue(0.5);
    const result = await computeCopyTradeSize(
      { ...buySwap, solAmount: 0.4 },
      baseConfig,
    );
    expect(result.tradeSol).toBeLessThanOrEqual(0.08);
    expect(result.tradeSol).toBeGreaterThanOrEqual(0.02);
  });

  it("fixed mode wanneer COPY_SIZE_MODE fixed", async () => {
    const fixedConfig = { ...baseConfig, copySizeMode: "fixed" as const };
    const result = await computeCopyTradeSize(buySwap, fixedConfig);
    expect(result.mode).toBe("fixed");
    expect(result.tradeSol).toBe(0.05);
  });
});
