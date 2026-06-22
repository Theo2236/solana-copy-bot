import { isAuthorizedDashboard } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";
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
import type { DashboardConfig, DashboardData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiHandler(async () => {
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

    const dashboardConfig: DashboardConfig = {
      tradeSizeSol: config.tradeSizeSol,
      copySizeMode: config.copySizeMode,
      referenceConvictionPct: config.referenceConvictionPct,
      minCopyTradeSol: config.minCopyTradeSol,
      maxCopyTradeSol: config.maxCopyTradeSol,
      maxOpenPositions: config.maxOpenPositions,
      stopLossPct: config.stopLossPct,
      takeProfitPct: config.takeProfitPct,
      minLiquidityUsd: config.minLiquidityUsd,
      minTokenAgeHours: config.minTokenAgeHours,
      slippageBps: config.slippageBps,
      maxBuyPriceImpactPct: config.maxBuyPriceImpactPct,
      targetAutoDisableMinTrades: config.targetAutoDisableMinTrades,
      targetAutoDisableMaxLossSol: config.targetAutoDisableMaxLossSol,
      minTargetConvictionPct: config.minTargetConvictionPct,
      homerunTiersEnabled: config.homerunTiersEnabled,
      homerunTier1PnlPct: config.homerunTier1PnlPct,
      homerunTier1SellFraction: config.homerunTier1SellFraction,
      homerunTier2PnlPct: config.homerunTier2PnlPct,
      homerunTier2SellOriginalFraction: config.homerunTier2SellOriginalFraction,
      homerunTrailingStopPct: config.homerunTrailingStopPct,
    };

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
  });
}
