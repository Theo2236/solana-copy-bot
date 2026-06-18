import { isAuthorizedDashboard } from "@/lib/auth";
import { manualSellPosition } from "@/lib/copy-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAuthorizedDashboard(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { positionId?: string };
  try {
    body = (await request.json()) as { positionId?: string };
  } catch {
    return Response.json({ error: "Ongeldige JSON body" }, { status: 400 });
  }

  const positionId = body.positionId?.trim();
  if (!positionId) {
    return Response.json({ error: "positionId is verplicht" }, { status: 400 });
  }

  const result = await manualSellPosition(positionId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({
    ok: true,
    pnlSol: result.pnlSol,
    exitSol: result.exitSol,
    signature: result.signature,
    dryRun: result.dryRun,
  });
}
