export const DASHBOARD_PASSWORD_STORAGE_KEY = "solana-copy-bot-dashboard-password";

export function getStoredDashboardPassword(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(DASHBOARD_PASSWORD_STORAGE_KEY);
}

export function setStoredDashboardPassword(password: string): void {
  sessionStorage.setItem(DASHBOARD_PASSWORD_STORAGE_KEY, password);
}

export function clearStoredDashboardPassword(): void {
  sessionStorage.removeItem(DASHBOARD_PASSWORD_STORAGE_KEY);
}

export function dashboardFetchInit(
  init: RequestInit = {},
): RequestInit {
  const password = getStoredDashboardPassword();
  if (!password) return init;

  const headers = new Headers(init.headers);
  headers.set("x-dashboard-password", password);
  return { ...init, headers };
}
