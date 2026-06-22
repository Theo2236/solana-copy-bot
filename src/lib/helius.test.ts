import { describe, expect, it } from "vitest";
import { parseHeliusSwap } from "./helius";

const WALLET = "CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o";
const MEMECOIN = "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr";

describe("parseHeliusSwap", () => {
  const tracked = new Set([WALLET]);

  it("parseert SOL buy via events.swap", () => {
    const payload = {
      signature: "sig123",
      timestamp: 1_700_000_000,
      feePayer: WALLET,
      events: {
        swap: {
          nativeInput: { account: WALLET, amount: "100000000" },
          tokenOutputs: [
            {
              mint: MEMECOIN,
              rawTokenAmount: { tokenAmount: "1000000" },
            },
          ],
          tokenInputs: [],
        },
      },
    };

    const swap = parseHeliusSwap(payload, tracked);
    expect(swap).not.toBeNull();
    expect(swap?.side).toBe("buy");
    expect(swap?.mint).toBe(MEMECOIN);
    expect(swap?.solAmount).toBe(0.1);
    expect(swap?.quote).toBe("SOL");
  });

  it("parseert SOL sell via events.swap", () => {
    const payload = {
      signature: "sig456",
      timestamp: 1_700_000_000,
      feePayer: WALLET,
      events: {
        swap: {
          nativeOutput: { account: WALLET, amount: "50000000" },
          tokenInputs: [
            {
              mint: MEMECOIN,
              rawTokenAmount: { tokenAmount: "500000" },
            },
          ],
          tokenOutputs: [],
        },
      },
    };

    const swap = parseHeliusSwap(payload, tracked);
    expect(swap?.side).toBe("sell");
    expect(swap?.solAmount).toBe(0.05);
  });

  it("retourneert null voor niet-getrackte wallet", () => {
    const payload = {
      feePayer: "Bi4rd5FH5bYEN8scZ7wevxNZyNmKHdaBcvewdPFxYdLt",
      events: {
        swap: {
          nativeInput: { amount: "100000000" },
          tokenOutputs: [{ mint: MEMECOIN, rawTokenAmount: { tokenAmount: "1" } }],
        },
      },
    };
    expect(parseHeliusSwap(payload, tracked)).toBeNull();
  });

  it("negeert SOL-only swaps", () => {
    const payload = {
      feePayer: WALLET,
      events: {
        swap: {
          nativeInput: { amount: "100000000" },
          tokenOutputs: [],
          tokenInputs: [],
        },
      },
    };
    expect(parseHeliusSwap(payload, tracked)).toBeNull();
  });
});
