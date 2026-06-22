import { afterEach, describe, expect, it } from "vitest";
import { getBotConfig, isCopyableMint, SOL_MINT, USDC_MINT } from "./config";

describe("config", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("isCopyableMint filtert SOL en stablecoins", () => {
    expect(isCopyableMint(SOL_MINT)).toBe(false);
    expect(isCopyableMint(USDC_MINT)).toBe(false);
    expect(isCopyableMint("7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr")).toBe(
      true,
    );
  });

  it("default trade size is 0.05 SOL", () => {
    delete process.env.TRADE_SIZE_SOL;
    expect(getBotConfig().tradeSizeSol).toBe(0.05);
  });

  it("copySizeMode is conviction tenzij fixed", () => {
    delete process.env.COPY_SIZE_MODE;
    expect(getBotConfig().copySizeMode).toBe("conviction");
    process.env.COPY_SIZE_MODE = "fixed";
    expect(getBotConfig().copySizeMode).toBe("fixed");
  });
});
