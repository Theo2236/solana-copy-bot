import { isAuthorizedDashboard } from "@/lib/auth";
import { getBotConfig } from "@/lib/config";
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

  const data: DashboardData & { botWallet?: string | null } = {
    stats,
    positions: await getPositions(),
    recentEvents: await getRecentEvents(100),
    targets: await getTargets(),
    config: {
      tradeSizeSol: config.tradeSizeSol,
      maxOpenPositions: config.maxOpenPositions,
      maxTradesPerDay: config.maxTradesPerDay,
      stopLossPct: config.stopLossPct,
      takeProfitPct: config.takeProfitPct,
    },
    botWallet: getBotPublicKey(),
  };

  return Response.json(data);
}
