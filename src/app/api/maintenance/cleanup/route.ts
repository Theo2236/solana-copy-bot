import { isAuthorizedDashboard } from "@/lib/auth";
import { isCopyableMint } from "@/lib/config";
import {
  addEvent,
  createEventId,
  getPositions,
  savePositions,
} from "@/lib/store";

export const runtime = "nodejs";

/**
 * Verwijdert open posities die geen echte memecoin zijn (bijv. een SOL→USDC
 * swap die per ongeluk als positie werd geopend). Beveiligd met dashboard-auth.
 */
export async function POST(request: Request) {
  if (!isAuthorizedDashboard(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const positions = await getPositions();
  const removed = positions.filter(
    (p) => p.status === "open" && !isCopyableMint(p.mint),
  );

  if (removed.length === 0) {
    return Response.json({ ok: true, removed: 0, mints: [] });
  }

  const keep = positions.filter(
    (p) => !(p.status === "open" && !isCopyableMint(p.mint)),
  );
  await savePositions(keep);

  for (const position of removed) {
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "position_close",
      mint: position.mint,
      message: `Opgeschoond: geen memecoin-positie (${position.mint}) verwijderd`,
      metadata: { reason: "non_memecoin_cleanup" },
    });
  }

  return Response.json({
    ok: true,
    removed: removed.length,
    mints: removed.map((p) => p.mint),
  });
}
