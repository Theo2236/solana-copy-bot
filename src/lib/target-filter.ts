import { getBotConfig } from "./config";
import { computeTargetPerformance } from "./derived-stats";
import {
  addEvent,
  createEventId,
  getPositions,
  getTargets,
  setTargetEnabled,
} from "./store";

/**
 * Schakelt targets automatisch uit als ze genoeg copy-trades hebben maar
 * structureel verlies maken. Retourneert labels van uitgeschakelde targets.
 */
export async function autoDisableUnderperformingTargets(): Promise<string[]> {
  const config = getBotConfig();
  if (config.targetAutoDisableMinTrades <= 0) {
    return [];
  }

  const [positions, targets] = await Promise.all([
    getPositions(),
    getTargets(),
  ]);
  const performance = computeTargetPerformance(positions, targets);
  const disabled: string[] = [];

  for (const perf of performance) {
    const closedTrades = perf.wins + perf.losses;
    if (closedTrades < config.targetAutoDisableMinTrades) {
      continue;
    }
    if (perf.realizedPnlSol >= config.targetAutoDisableMaxLossSol) {
      continue;
    }

    const target = targets.find((t) => t.address === perf.address);
    if (!target?.enabled) {
      continue;
    }

    await setTargetEnabled(perf.address, false);
    disabled.push(target.label);

    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "skip",
      wallet: perf.address,
      message: `Target "${target.label}" automatisch uitgeschakeld (${closedTrades} trades, PnL ${perf.realizedPnlSol.toFixed(4)} SOL)`,
      metadata: {
        reason: "auto_disable_underperformance",
        closedTrades,
        realizedPnlSol: perf.realizedPnlSol,
      },
    });
  }

  return disabled;
}
