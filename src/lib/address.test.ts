import { describe, expect, it } from "vitest";
import { isLikelySolanaAddress } from "./address";

describe("isLikelySolanaAddress", () => {
  it("accepteert geldig base58-adres", () => {
    expect(
      isLikelySolanaAddress("CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o"),
    ).toBe(true);
  });

  it("weigert te korte string", () => {
    expect(isLikelySolanaAddress("abc")).toBe(false);
  });

  it("weigert ongeldige tekens (0, O, I, l)", () => {
    expect(
      isLikelySolanaAddress("0000000000000000000000000000000000000000"),
    ).toBe(false);
  });

  it("trimt whitespace", () => {
    expect(
      isLikelySolanaAddress("  CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o  "),
    ).toBe(true);
  });
});
