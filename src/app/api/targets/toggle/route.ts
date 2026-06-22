import { isAuthorizedDashboard } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";
import { addEvent, createEventId, setTargetEnabled } from "@/lib/store";
import { syncHeliusWebhook } from "@/lib/webhook-sync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withApiHandler(async () => {
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
    const { webhook, webhookError } = await syncHeliusWebhook();

    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "cron_poll",
      wallet: address,
      message: body.enabled
        ? `Target ingeschakeld via dashboard: ${address}`
        : `Target uitgeschakeld via dashboard: ${address}`,
      metadata: {
        webhookRegistered: webhook !== null,
        webhookError: webhookError ?? undefined,
      },
    });

    return Response.json({ ok: true, targets, webhook, webhookError });
  });
}
