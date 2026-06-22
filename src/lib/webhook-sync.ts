import { registerHeliusWebhook } from "./helius";
import { getTargets } from "./store";

export type WebhookSyncResult = {
  webhook: { webhookId: string; webhookUrl: string } | null;
  webhookError: string | null;
};

export async function syncHeliusWebhook(): Promise<WebhookSyncResult> {
  try {
    const targets = await getTargets();
    const addresses = targets.filter((t) => t.enabled).map((t) => t.address);
    const webhook = await registerHeliusWebhook(addresses);
    return { webhook, webhookError: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Webhook registratie mislukt";
    console.error("[webhook-sync]", err);
    return { webhook: null, webhookError: message };
  }
}
