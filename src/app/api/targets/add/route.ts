import { isAuthorizedDashboard } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";
import { isLikelySolanaAddress } from "@/lib/address";
import { getWalletActivity } from "@/lib/helius";
import { addEvent, addTarget, createEventId } from "@/lib/store";
import { syncHeliusWebhook } from "@/lib/webhook-sync";
import type { TargetWallet } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Voegt een nieuwe target-wallet toe. Optioneel `requireActivity` om alleen
 * wallets met recente swaps toe te laten. Registreert daarna de Helius-webhook
 * opnieuw zodat de nieuwe wallet ook live gevolgd wordt.
 */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    if (!isAuthorizedDashboard(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: {
      address?: string;
      label?: string;
      pnl30dSol?: number;
      winRate?: number;
      requireActivity?: boolean;
    } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const address = body.address?.trim();
    if (!address || !isLikelySolanaAddress(address)) {
      return Response.json({ error: "Ongeldig Solana-adres" }, { status: 400 });
    }

    const activity = await getWalletActivity(address);
    if (
      body.requireActivity !== false &&
      activity.ok &&
      activity.swapCount === 0
    ) {
      return Response.json(
        { error: "Wallet heeft geen recente swaps", activity },
        { status: 422 },
      );
    }

    const target: TargetWallet = {
      address,
      label: body.label?.trim() || `Wallet ${address.slice(0, 4)}`,
      pnl30dSol: Number(body.pnl30dSol ?? 0),
      winRate: Number(body.winRate ?? 0),
      enabled: true,
    };

    const { added } = await addTarget(target);
    const { webhook, webhookError } = await syncHeliusWebhook();

    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "cron_poll",
      wallet: address,
      message: added
        ? `Nieuwe target toegevoegd: ${target.label} (${address})`
        : `Target bijgewerkt: ${target.label} (${address})`,
      metadata: {
        activity,
        webhookRegistered: webhook !== null,
        webhookError: webhookError ?? undefined,
      },
    });

    return Response.json({
      ok: true,
      added,
      target,
      activity,
      webhook,
      webhookError,
    });
  });
}
