import { isAuthorizedCron } from "@/lib/auth";
import { runTargetPoll } from "@/lib/poll";
import { addEvent, createEventId } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { processed, targets } = await runTargetPoll(3);

  await addEvent({
    id: createEventId(),
    timestamp: new Date().toISOString(),
    type: "cron_poll",
    message: `Cron poll afgerond (${processed} swaps gecontroleerd)`,
  });

  return Response.json({ ok: true, processed, targets });
}
