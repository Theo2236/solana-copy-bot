import { getAuthConfigWarnings } from "./auth";
import { getCronSecret, getDashboardPassword } from "./config";
import { getBotPublicKey } from "./solana";
import type { HealthStatus } from "./types";

/** Boven deze stilte (minuten) tonen we een waarschuwing op het dashboard. */
export const SILENCE_WARNING_MINUTES = 6 * 60;

export function computeHealth(lastEventAt?: string): HealthStatus {
  const redisConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN,
  );
  const heliusConfigured = Boolean(process.env.HELIUS_API_KEY);
  const botWalletConfigured = Boolean(getBotPublicKey());
  const webhookSecretConfigured = Boolean(process.env.HELIUS_WEBHOOK_SECRET);
  const cronSecretConfigured = Boolean(getCronSecret());
  const dashboardPasswordConfigured = Boolean(getDashboardPassword());
  const authWarnings = getAuthConfigWarnings();
  const mode = process.env.BOT_MODE === "live" ? "live" : "dry_run";

  let minutesSinceLastEvent: number | null = null;
  if (lastEventAt) {
    const t = new Date(lastEventAt).getTime();
    if (!Number.isNaN(t)) {
      minutesSinceLastEvent = Math.max(0, (Date.now() - t) / 60000);
    }
  }

  const silenceWarning =
    minutesSinceLastEvent !== null &&
    minutesSinceLastEvent > SILENCE_WARNING_MINUTES;

  return {
    redisConfigured,
    heliusConfigured,
    botWalletConfigured,
    webhookSecretConfigured,
    cronSecretConfigured,
    dashboardPasswordConfigured,
    authWarnings,
    mode,
    lastEventAt,
    minutesSinceLastEvent,
    silenceWarning,
  };
}
