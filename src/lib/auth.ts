import { getCronSecret, getDashboardPassword } from "./config";

export function isAuthorizedCron(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return process.env.NODE_ENV !== "production";

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export function isAuthorizedDashboard(request: Request): boolean {
  const password = getDashboardPassword();
  if (!password) return true;

  const header = request.headers.get("x-dashboard-password");
  const url = new URL(request.url);
  const queryPassword = url.searchParams.get("password");

  return header === password || queryPassword === password;
}

export function isAuthorizedWebhook(request: Request): boolean {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (!secret) return true;

  const header = request.headers.get("authorization");
  return header === secret;
}
