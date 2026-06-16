import type {
  BotStats,
  DerivedStats,
  PnlPoint,
  Position,
  TargetPerformance,
  TargetWallet,
  TradeEvent,
} from "./types";

function startOfTodayMs(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeekMs(now = Date.now()): number {
  const d = new Date(now);
  const day = d.getDay(); // 0 = zondag
  const diff = (day + 6) % 7; // maandag als weekstart
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

function closedWithPnl(positions: Position[]): Position[] {
  return positions.filter(
    (p) => p.status === "closed" && typeof p.pnlSol === "number",
  );
}

export function computeDerivedStats(
  positions: Position[],
  events: TradeEvent[],
  stats: BotStats,
  balanceSol: number,
): DerivedStats {
  const closed = closedWithPnl(positions);
  const open = positions.filter((p) => p.status === "open");

  const pnls = closed.map((p) => p.pnlSol as number);
  const decided = stats.wins + stats.losses;

  const todayStart = startOfTodayMs();
  const weekStart = startOfWeekMs();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

  let pnlTodaySol = 0;
  let pnlWeekSol = 0;
  for (const p of closed) {
    if (!p.closedAt) continue;
    const t = new Date(p.closedAt).getTime();
    if (Number.isNaN(t)) continue;
    const pnl = p.pnlSol as number;
    if (!Number.isFinite(pnl)) continue;
    if (t >= todayStart) pnlTodaySol += pnl;
    if (t >= weekStart) pnlWeekSol += pnl;
  }

  let skipCount24h = 0;
  let errorCount24h = 0;
  let copyCount24h = 0;
  for (const e of events) {
    const t = new Date(e.timestamp).getTime();
    if (Number.isNaN(t) || t < dayAgo) continue;
    if (e.type === "skip") skipCount24h += 1;
    else if (e.type === "error") errorCount24h += 1;
    else if (e.type === "copy_buy" || e.type === "copy_sell") copyCount24h += 1;
  }

  const openExposureSol = open.reduce(
    (sum, p) => sum + (Number.isFinite(p.entrySol) ? p.entrySol : 0),
    0,
  );

  return {
    winRate: decided > 0 ? (stats.wins / decided) * 100 : null,
    closedTrades: closed.length,
    avgPnlSol:
      pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : null,
    bestTradeSol: pnls.length > 0 ? Math.max(...pnls) : null,
    worstTradeSol: pnls.length > 0 ? Math.min(...pnls) : null,
    pnlTodaySol,
    pnlWeekSol,
    openExposureSol,
    exposurePct:
      balanceSol > 0 ? (openExposureSol / balanceSol) * 100 : null,
    skipCount24h,
    errorCount24h,
    copyCount24h,
  };
}

export function computeTargetPerformance(
  positions: Position[],
  targets: TargetWallet[],
): TargetPerformance[] {
  const labelByAddress = new Map(targets.map((t) => [t.address, t.label]));
  const byWallet = new Map<string, TargetPerformance>();

  for (const p of positions) {
    const address = p.sourceWallet || "onbekend";
    let entry = byWallet.get(address);
    if (!entry) {
      entry = {
        address,
        label: labelByAddress.get(address) ?? "Onbekend",
        trades: 0,
        wins: 0,
        losses: 0,
        openTrades: 0,
        realizedPnlSol: 0,
      };
      byWallet.set(address, entry);
    }

    entry.trades += 1;
    if (p.status === "open") {
      entry.openTrades += 1;
    } else if (typeof p.pnlSol === "number") {
      entry.realizedPnlSol += p.pnlSol;
      if (p.pnlSol >= 0) entry.wins += 1;
      else entry.losses += 1;
    }

    const activity = p.closedAt ?? p.openedAt;
    if (activity && (!entry.lastActivityAt || activity > entry.lastActivityAt)) {
      entry.lastActivityAt = activity;
    }
  }

  return Array.from(byWallet.values()).sort(
    (a, b) => b.realizedPnlSol - a.realizedPnlSol,
  );
}

export function computePnlTimeline(
  positions: Position[],
  days = 30,
): PnlPoint[] {
  const byDate = new Map<string, PnlPoint>();

  for (const p of closedWithPnl(positions)) {
    if (!p.closedAt) continue;
    const date = p.closedAt.slice(0, 10);
    let point = byDate.get(date);
    if (!point) {
      point = { date, pnlSol: 0, trades: 0 };
      byDate.set(date, point);
    }
    point.pnlSol += p.pnlSol as number;
    point.trades += 1;
  }

  return Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
}
