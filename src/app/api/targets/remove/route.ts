import { isAuthorizedDashboard } from "@/lib/auth";
import { registerHeliusWebhook } from "@/lib/helius";
import { addEvent, createEventId, getTargets, removeTarget } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAuthorizedDashboard(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { address?: string } = {};
  try {
    body = (await request.json()) as { address?: string };
  } catch {
    body = {};
  }

  const address = body.address?.trim();
  if (!address) {
    return Response.json({ error: "address is verplicht" }, { status: 400 });
  }

  const targets = await removeTarget(address);

  try {
    const addresses = targets.filter((t) => t.enabled).map((t) => t.address);
    await registerHeliusWebhook(addresses);
  } catch {
    // webhook re-registratie is best-effort
  }

  await addEvent({
    id: createEventId(),
    timestamp: new Date().toISOString(),
    type: "cron_poll",
    wallet: address,
    message: `Target verwijderd via dashboard: ${address}`,
  });

  return Response.json({ ok: true, targets });
}
