import { isAuthorizedCron } from "@/lib/auth";
import { runTargetPoll } from "@/lib/poll";
import { addEvent, createEventId } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { processed, targets, disabledTargets } = await runTargetPoll(5);

  await addEvent({
    id: createEventId(),
    timestamp: new Date().toISOString(),
    type: "cron_poll",
    message:
      disabledTargets.length > 0
        ? `Cron poll afgerond (${processed} swaps) — targets uit: ${disabledTargets.join(", ")}`
        : `Cron poll afgerond (${processed} swaps gecontroleerd)`,
  });

  return Response.json({ ok: true, processed, targets, disabledTargets });
}
