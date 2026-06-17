import { isAuthorizedDashboard } from "@/lib/auth";
import { runTargetPoll } from "@/lib/poll";
import { addEvent, createEventId } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Handmatige poll vanuit het dashboard (Refresh-knop). */
export async function POST(request: Request) {
  if (!isAuthorizedDashboard(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { processed, targets, disabledTargets } = await runTargetPoll(8);

    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "cron_poll",
      message:
        disabledTargets.length > 0
          ? `Handmatige refresh: ${processed} swaps (${targets} wallets) — targets uit: ${disabledTargets.join(", ")}`
          : `Handmatige refresh: ${processed} swaps gecontroleerd (${targets} wallets)`,
    });

    return Response.json({ ok: true, processed, targets, disabledTargets });
  } catch (error) {
    console.error("Manual poll error", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Poll mislukt",
      },
      { status: 500 },
    );
  }
}
