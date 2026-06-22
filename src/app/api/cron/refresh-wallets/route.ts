import { isAuthorizedCron } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";
import { DEFAULT_TARGETS } from "@/lib/config";
import { addEvent, createEventId, getTargets, saveTargets } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withApiHandler(async () => {
    if (!isAuthorizedCron(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await getTargets();
    const defaultAddresses = new Set<string>(
      DEFAULT_TARGETS.map((t) => t.address),
    );

    const refreshedDefaults = DEFAULT_TARGETS.map((defaults) => {
      const current = existing.find((e) => e.address === defaults.address);
      return {
        ...defaults,
        enabled: current?.enabled ?? defaults.enabled,
      };
    });

    const customTargets = existing.filter(
      (t) => !defaultAddresses.has(t.address),
    );
    const merged = [...refreshedDefaults, ...customTargets];

    await saveTargets(merged);

    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "cron_poll",
      message: "Target wallets ververst vanuit leaderboard-config",
    });

    return Response.json({ ok: true, targets: merged });
  });
}
