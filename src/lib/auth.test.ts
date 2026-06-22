import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAuthConfigWarnings,
  isAuthorizedCron,
  isAuthorizedDashboard,
  isAuthorizedWebhook,
} from "./auth";

function cronRequest(secret?: string): Request {
  return new Request("http://localhost/api/cron/poll", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

function dashboardRequest(password?: string): Request {
  return new Request("http://localhost/api/stats", {
    headers: password ? { "x-dashboard-password": password } : {},
  });
}

function webhookRequest(secret?: string): Request {
  return new Request("http://localhost/api/webhook/helius", {
    headers: secret ? { authorization: secret } : {},
  });
}

describe("auth", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  describe("development (permissive)", () => {
    it("staat cron toe zonder secret", () => {
      process.env.NODE_ENV = "development";
      delete process.env.CRON_SECRET;
      expect(isAuthorizedCron(cronRequest())).toBe(true);
    });

    it("staat dashboard toe zonder wachtwoord", () => {
      process.env.NODE_ENV = "development";
      delete process.env.DASHBOARD_PASSWORD;
      expect(isAuthorizedDashboard(dashboardRequest())).toBe(true);
    });

    it("geeft geen auth-waarschuwingen", () => {
      process.env.NODE_ENV = "development";
      expect(getAuthConfigWarnings()).toEqual([]);
    });
  });

  describe("production (fail-closed)", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("blokkeert cron zonder CRON_SECRET", () => {
      delete process.env.CRON_SECRET;
      expect(isAuthorizedCron(cronRequest())).toBe(false);
    });

    it("accepteert cron met juist secret", () => {
      process.env.CRON_SECRET = "test-cron";
      expect(isAuthorizedCron(cronRequest("test-cron"))).toBe(true);
    });

    it("blokkeert dashboard zonder DASHBOARD_PASSWORD", () => {
      delete process.env.DASHBOARD_PASSWORD;
      expect(isAuthorizedDashboard(dashboardRequest())).toBe(false);
    });

    it("accepteert dashboard met juist wachtwoord", () => {
      process.env.DASHBOARD_PASSWORD = "secret";
      expect(isAuthorizedDashboard(dashboardRequest("secret"))).toBe(true);
    });

    it("blokkeert webhook zonder HELIUS_WEBHOOK_SECRET", () => {
      delete process.env.HELIUS_WEBHOOK_SECRET;
      expect(isAuthorizedWebhook(webhookRequest())).toBe(false);
    });

    it("rapporteert ontbrekende secrets", () => {
      delete process.env.CRON_SECRET;
      delete process.env.DASHBOARD_PASSWORD;
      delete process.env.HELIUS_WEBHOOK_SECRET;
      const warnings = getAuthConfigWarnings();
      expect(warnings).toHaveLength(3);
    });
  });
});
