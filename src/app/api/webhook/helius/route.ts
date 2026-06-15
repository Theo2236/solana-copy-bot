import { isAuthorizedWebhook } from "@/lib/auth";
import { processSwap } from "@/lib/copy-engine";
import { parseHeliusSwap } from "@/lib/helius";
import { addEvent, createEventId, getTargets } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAuthorizedWebhook(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payloads = Array.isArray(body) ? body : [body];
    const targets = await getTargets();
    const tracked = new Set(
      targets.filter((t) => t.enabled).map((t) => t.address),
    );

    let processed = 0;
    const errors: string[] = [];

    for (const payload of payloads) {
      const swap = parseHeliusSwap(payload, tracked);
      if (!swap) continue;

      await addEvent({
        id: createEventId(),
        timestamp: new Date().toISOString(),
        type: "webhook_received",
        wallet: swap.wallet,
        mint: swap.mint,
        message: `${swap.side.toUpperCase()} gedetecteerd van ${swap.wallet}`,
        txSignature: swap.signature,
      });

      try {
        await processSwap(swap);
        processed += 1;
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "onbekende copy-fout";
        console.error("Copy-engine error", { swap: swap.signature, error });
        errors.push(msg);
        await addEvent({
          id: createEventId(),
          timestamp: new Date().toISOString(),
          type: "error",
          wallet: swap.wallet,
          mint: swap.mint,
          message: `Copy mislukt: ${msg}`,
          txSignature: swap.signature,
        });
      }
    }

    return Response.json({ ok: true, processed, errors });
  } catch (error) {
    console.error("Webhook error", error);
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "error",
      message: `Webhook verwerking mislukt: ${error instanceof Error ? error.message : "onbekend"}`,
    });
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
