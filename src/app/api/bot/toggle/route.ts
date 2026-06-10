import { isAuthorizedDashboard } from "@/lib/auth";
import { addEvent, createEventId, getBotEnabledState, setBotEnabled } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAuthorizedDashboard(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { enabled?: boolean };
  const current = await getBotEnabledState();
  const next = body.enabled ?? !current;

  await setBotEnabled(next);
  await addEvent({
    id: createEventId(),
    timestamp: new Date().toISOString(),
    type: "cron_poll",
    message: next ? "Bot ingeschakeld via dashboard" : "Bot uitgeschakeld via dashboard",
  });

  return Response.json({ ok: true, enabled: next });
}
