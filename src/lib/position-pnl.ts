import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { Position } from "./types";

/** Zet een quote `inAmount` / `outAmount` (lamports) om naar SOL. */
export function quoteLamportsToSol(lamports: string | undefined): number {
  if (!lamports) return 0;
  const n = Number(lamports);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n / LAMPORTS_PER_SOL;
}

/** Som van gerealiseerde PnL: gesloten posities + gedeeltelijke verkopen op open posities. */
export function computeRealizedPnlFromPositions(positions: Position[]): number {
  let total = 0;
  for (const position of positions) {
    if (
      position.status === "closed" &&
      typeof position.pnlSol === "number" &&
      Number.isFinite(position.pnlSol)
    ) {
      total += position.pnlSol;
      continue;
    }
    if (position.status === "open") {
      const partial = position.realizedPnlSol ?? 0;
      if (Number.isFinite(partial)) total += partial;
    }
  }
  return total;
}

export function computeTradeOutcomeStats(positions: Position[]): {
  wins: number;
  losses: number;
} {
  let wins = 0;
  let losses = 0;
  for (const position of positions) {
    if (
      position.status !== "closed" ||
      typeof position.pnlSol !== "number" ||
      !Number.isFinite(position.pnlSol)
    ) {
      continue;
    }
    if (position.pnlSol >= 0) wins += 1;
    else losses += 1;
  }
  return { wins, losses };
}

/**
 * Herberekent `pnlSol` voor gesloten posities wanneer exit- en entry-waarden
 * (uit quotes) bekend zijn maar de opgeslagen PnL afwijkt.
 */
export function reconcileClosedPositionPnl(position: Position): Position {
  if (position.status !== "closed") return position;
  if (
    typeof position.exitSol !== "number" ||
    !Number.isFinite(position.exitSol) ||
    !Number.isFinite(position.entrySol)
  ) {
    return position;
  }

  const expected =
    (position.realizedPnlSol ?? 0) + position.exitSol - position.entrySol;
  if (!Number.isFinite(expected)) return position;

  const current = position.pnlSol;
  if (typeof current === "number" && Math.abs(current - expected) < 1e-10) {
    return position;
  }
  return { ...position, pnlSol: expected };
}
