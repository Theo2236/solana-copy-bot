import { isAuthorizedDashboard } from "@/lib/auth";
import { addEvent, createEventId, setTargetEnabled } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAuthorizedDashboard(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { address?: string; enabled?: boolean } = {};
  try {
    body = (await request.json()) as { address?: string; enabled?: boolean };
  } catch {
    body = {};
  }

  const address = body.address?.trim();
  if (!address) {
    return Response.json({ error: "address is verplicht" }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return Response.json({ error: "enabled is verplicht" }, { status: 400 });
  }

  const targets = await setTargetEnabled(address, body.enabled);
  await addEvent({
    id: createEventId(),
    timestamp: new Date().toISOString(),
    type: "cron_poll",
    wallet: address,
    message: body.enabled
      ? `Target ingeschakeld via dashboard: ${address}`
      : `Target uitgeschakeld via dashboard: ${address}`,
  });

  return Response.json({ ok: true, targets });
}
