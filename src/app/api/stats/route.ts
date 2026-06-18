import { isAuthorizedDashboard } from "@/lib/auth";
import { getBotConfig } from "@/lib/config";
import {
  computeDerivedStats,
  computePnlTimeline,
  computeTargetPerformance,
} from "@/lib/derived-stats";
import { computeHealth } from "@/lib/health";
import { computeOpenPositionMarks } from "@/lib/position-marks";
import { getSolPriceEur } from "@/lib/price";
import {
  getPositions,
  getRecentEvents,
  getStats,
  getTargets,
} from "@/lib/store";
import { getBotBalanceSol, getBotPublicKey } from "@/lib/solana";
import type { DashboardData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedDashboard(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [balanceSol, solPriceEur] = await Promise.all([
    getBotBalanceSol(),
    getSolPriceEur(),
  ]);
  const stats = await getStats(balanceSol);
  stats.solPriceEur = solPriceEur;
  const config = getBotConfig();

  const [positions, recentEvents, targets] = await Promise.all([
    getPositions(),
    getRecentEvents(100),
    getTargets(),
  ]);

  const openPositionMarks = await computeOpenPositionMarks(
    positions,
    config.slippageBps,
  );

  const { targets: _omitTargets, ...dashboardConfig } = config;

  const data: DashboardData = {
    stats,
    positions,
    openPositionMarks,
    recentEvents,
    targets,
    config: dashboardConfig,
    derivedStats: computeDerivedStats(
      positions,
      recentEvents,
      stats,
      balanceSol,
    ),
    targetPerformance: computeTargetPerformance(positions, targets),
    pnlTimeline: computePnlTimeline(positions),
    health: computeHealth(stats.lastEventAt),
    botWallet: getBotPublicKey(),
  };

  return Response.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
