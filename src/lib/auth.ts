import { getCronSecret, getDashboardPassword } from "./config";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isAuthorizedCron(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) {
    return !isProduction();
  }

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export function isAuthorizedDashboard(request: Request): boolean {
  const password = getDashboardPassword();
  if (!password) {
    return !isProduction();
  }

  const header = request.headers.get("x-dashboard-password");
  const url = new URL(request.url);
  const queryPassword = url.searchParams.get("password");

  return header === password || queryPassword === password;
}

export function isAuthorizedWebhook(request: Request): boolean {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (!secret) {
    return !isProduction();
  }

  const header = request.headers.get("authorization");
  return header === secret;
}

/** Waarschuwingen wanneer productie-auth secrets ontbreken. */
export function getAuthConfigWarnings(): string[] {
  if (!isProduction()) return [];

  const warnings: string[] = [];
  if (!getCronSecret()) {
    warnings.push("CRON_SECRET ontbreekt — cron endpoints geblokkeerd");
  }
  if (!getDashboardPassword()) {
    warnings.push("DASHBOARD_PASSWORD ontbreekt — dashboard geblokkeerd");
  }
  if (!process.env.HELIUS_WEBHOOK_SECRET) {
    warnings.push("HELIUS_WEBHOOK_SECRET ontbreekt — webhook geblokkeerd");
  }
  return warnings;
}
