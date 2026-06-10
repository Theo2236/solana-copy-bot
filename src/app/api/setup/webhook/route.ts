import { isAuthorizedDashboard } from "@/lib/auth";
import { registerHeliusWebhook } from "@/lib/helius";
import { addEvent, createEventId, getTargets } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAuthorizedDashboard(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const targets = await getTargets();
    const addresses = targets.filter((t) => t.enabled).map((t) => t.address);
    const result = await registerHeliusWebhook(addresses);

    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "cron_poll",
      message: `Helius webhook geregistreerd voor ${addresses.length} wallets`,
      metadata: result,
    });

    return Response.json({ ok: true, ...result, addresses });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Webhook setup failed",
      },
      { status: 500 },
    );
  }
}
