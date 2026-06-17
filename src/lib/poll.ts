import { checkOpenPositions, processSwap } from "./copy-engine";
import { fetchRecentSwapsForWallet } from "./helius";
import { autoDisableUnderperformingTargets } from "./target-filter";
import { getTargets } from "./store";

/** Haalt recente swaps van alle actieve targets op en verwerkt ze (zelfde als cron). */
export async function runTargetPoll(swapsPerWallet = 5): Promise<{
  processed: number;
  targets: number;
  disabledTargets: string[];
}> {
  const targets = await getTargets().then((items) =>
    items.filter((t) => t.enabled),
  );

  let processed = 0;

  for (const target of targets) {
    const swaps = await fetchRecentSwapsForWallet(
      target.address,
      swapsPerWallet,
    );
    for (const swap of swaps) {
      await processSwap(swap);
      processed += 1;
    }
  }

  await checkOpenPositions();
  const disabledTargets = await autoDisableUnderperformingTargets();

  return { processed, targets: targets.length, disabledTargets };
}
