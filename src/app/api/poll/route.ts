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
    const { processed, targets } = await runTargetPoll(8);

    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "cron_poll",
      message: `Handmatige refresh: ${processed} swaps gecontroleerd (${targets} wallets)`,
    });

    return Response.json({ ok: true, processed, targets });
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
