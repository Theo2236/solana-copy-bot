import { describe, expect, it } from "vitest";
import { buildSearchQuery, pickBestMarketPrice } from "./pokemon-tcg";
import type { DetectedCard } from "./types";

describe("buildSearchQuery", () => {
  it("bouwt een query met naam, set en nummer", () => {
    const card: DetectedCard = {
      index: 1,
      name: "Pikachu",
      setName: "151",
      cardNumber: "025/165",
      condition: "near_mint",
      confidence: 0.9,
    };

    expect(buildSearchQuery(card)).toBe('name:"Pikachu" set.name:"151" number:25');
  });
});

describe("pickBestMarketPrice", () => {
  it("kiest de hoogste marktprijs uit varianten", () => {
    const total = pickBestMarketPrice([
      { variant: "normal", market: 1.5 },
      { variant: "holofoil", market: 4.25 },
    ]);

    expect(total).toBe(4.25);
  });
});
