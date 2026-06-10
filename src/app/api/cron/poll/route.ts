import { isAuthorizedCron } from "@/lib/auth";
import { checkOpenPositions, processSwap } from "@/lib/copy-engine";
import { fetchRecentSwapsForWallet } from "@/lib/helius";
import { addEvent, createEventId, getTargets } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targets = await getTargets().then((items) =>
    items.filter((t) => t.enabled),
  );

  let processed = 0;

  for (const target of targets) {
    const swaps = await fetchRecentSwapsForWallet(target.address, 3);
    for (const swap of swaps) {
      await processSwap(swap);
      processed += 1;
    }
  }

  await checkOpenPositions();

  await addEvent({
    id: createEventId(),
    timestamp: new Date().toISOString(),
    type: "cron_poll",
    message: `Cron poll afgerond (${processed} swaps gecontroleerd)`,
  });

  return Response.json({ ok: true, processed, targets: targets.length });
}
