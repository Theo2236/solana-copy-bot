import { describe, expect, it } from "vitest";
import {
  computeDerivedStats,
  computePnlTimeline,
  computeTargetPerformance,
} from "./derived-stats";
import type { BotStats, Position, TargetWallet, TradeEvent } from "./types";

const targets: TargetWallet[] = [
  {
    address: "wallet-a",
    label: "A",
    pnl30dSol: 100,
    winRate: 50,
    enabled: true,
  },
];

const stats: BotStats = {
  balanceSol: 1,
  openPositions: 0,
  realizedPnlSol: 0.1,
  totalTrades: 2,
  wins: 1,
  losses: 1,
  tradesToday: 0,
  botEnabled: true,
  mode: "dry_run",
};

describe("derived-stats", () => {
  it("computeDerivedStats berekent winrate", () => {
    const positions: Position[] = [
      {
        id: "1",
        mint: "m1",
        status: "closed",
        entrySol: 0.05,
        exitSol: 0.06,
        pnlSol: 0.01,
        openedAt: "2026-01-01T00:00:00.000Z",
        closedAt: "2026-01-02T00:00:00.000Z",
        sourceWallet: "wallet-a",
      },
      {
        id: "2",
        mint: "m2",
        status: "closed",
        entrySol: 0.05,
        exitSol: 0.04,
        pnlSol: -0.01,
        openedAt: "2026-01-01T00:00:00.000Z",
        closedAt: "2026-01-03T00:00:00.000Z",
        sourceWallet: "wallet-a",
      },
    ];
    const derived = computeDerivedStats(positions, [], stats, 1);
    expect(derived.winRate).toBe(50);
    expect(derived.closedTrades).toBe(2);
  });

  it("computeTargetPerformance groepeert per wallet", () => {
    const positions: Position[] = [
      {
        id: "1",
        mint: "m1",
        status: "closed",
        entrySol: 0.05,
        pnlSol: 0.02,
        openedAt: "2026-01-01T00:00:00.000Z",
        closedAt: "2026-01-02T00:00:00.000Z",
        sourceWallet: "wallet-a",
      },
    ];
    const perf = computeTargetPerformance(positions, targets);
    expect(perf).toHaveLength(1);
    expect(perf[0]?.label).toBe("A");
    expect(perf[0]?.wins).toBe(1);
  });

  it("computePnlTimeline aggregeert per dag", () => {
    const positions: Position[] = [
      {
        id: "1",
        mint: "m1",
        status: "closed",
        entrySol: 0.05,
        pnlSol: 0.03,
        openedAt: "2026-01-01T00:00:00.000Z",
        closedAt: "2026-06-01T12:00:00.000Z",
        sourceWallet: "wallet-a",
      },
      {
        id: "2",
        mint: "m2",
        status: "closed",
        entrySol: 0.05,
        pnlSol: 0.02,
        openedAt: "2026-01-01T00:00:00.000Z",
        closedAt: "2026-06-01T18:00:00.000Z",
        sourceWallet: "wallet-a",
      },
    ];
    const timeline = computePnlTimeline(positions);
    const june1 = timeline.find((p) => p.date === "2026-06-01");
    expect(june1?.pnlSol).toBeCloseTo(0.05);
    expect(june1?.trades).toBe(2);
  });

  it("telt events in laatste 24u", () => {
    const now = new Date().toISOString();
    const events: TradeEvent[] = [
      { id: "1", timestamp: now, type: "skip", message: "skip" },
      { id: "2", timestamp: now, type: "copy_buy", message: "buy" },
    ];
    const derived = computeDerivedStats([], events, stats, 1);
    expect(derived.skipCount24h).toBe(1);
    expect(derived.copyCount24h).toBe(1);
  });
});
