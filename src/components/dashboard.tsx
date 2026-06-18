"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearStoredDashboardPassword,
  dashboardFetchInit,
  getStoredDashboardPassword,
  setStoredDashboardPassword,
} from "@/lib/dashboard-client";
import type { DashboardData } from "@/lib/types";
import { BotStatusCard } from "./dashboard/BotStatusCard";
import { EventFeed } from "./dashboard/EventFeed";
import { HeaderActions } from "./dashboard/HeaderActions";
import { HistoryTable } from "./dashboard/HistoryTable";
import { KpiGrid } from "./dashboard/KpiGrid";
import { OpenPositions } from "./dashboard/OpenPositions";
import { PnlTimeline } from "./dashboard/PnlTimeline";
import { SettingsPanel } from "./dashboard/SettingsPanel";
import { SystemHealth } from "./dashboard/SystemHealth";
import { TabNav, type TabKey } from "./dashboard/TabNav";
import { TargetPerformanceTable } from "./dashboard/TargetPerformanceTable";
import { TargetsTable } from "./dashboard/TargetsTable";
import { CardSkeleton } from "./dashboard/ui";

type Feedback = { tone: "ok" | "error"; message: string };

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [botWallet, setBotWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sellingPositionId, setSellingPositionId] = useState<string | null>(
    null,
  );

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/stats?_=${Date.now()}`, {
        cache: "no-store",
        ...dashboardFetchInit(),
      });
      if (response.status === 401) {
        clearStoredDashboardPassword();
        setAuthenticated(false);
        throw new Error("Onjuist wachtwoord");
      }
      if (!response.ok) {
        throw new Error("Kon stats niet laden");
      }
      const json = (await response.json()) as DashboardData;
      setData(json);
      setBotWallet(json.botWallet ?? null);
      setError(null);
      setAuthenticated(true);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const pollResponse = await fetch(
        "/api/poll",
        dashboardFetchInit({ method: "POST" }),
      );
      if (pollResponse.status === 401) {
        clearStoredDashboardPassword();
        setAuthenticated(false);
        throw new Error("Onjuist wachtwoord");
      }

      let pollMessage: string | null = null;
      if (pollResponse.ok) {
        const pollJson = (await pollResponse.json()) as {
          processed?: number;
          targets?: number;
        };
        pollMessage = `${pollJson.processed ?? 0} swaps gecontroleerd (${pollJson.targets ?? 0} wallets)`;
      } else {
        const pollJson = (await pollResponse.json().catch(() => ({}))) as {
          error?: string;
        };
        pollMessage = pollJson.error ?? "Poll mislukt";
      }

      await fetchStats();

      if (pollResponse.ok) {
        setFeedback({ tone: "ok", message: `Ververs: ${pollMessage}` });
      } else {
        setFeedback({ tone: "error", message: pollMessage ?? "Poll mislukt" });
      }
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Verversen mislukt",
      });
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (getStoredDashboardPassword()) {
      setAuthenticated(true);
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [fetchStats]);

  useEffect(() => {
    if (!authenticated) return;
    const interval = setInterval(fetchStats, 15_000);
    return () => clearInterval(interval);
  }, [authenticated, fetchStats]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    const pwd = passwordInput.trim();
    if (!pwd) return;

    setLoginError(null);
    setLoading(true);
    setStoredDashboardPassword(pwd);

    try {
      const response = await fetch("/api/stats", {
        cache: "no-store",
        headers: { "x-dashboard-password": pwd },
      });
      if (response.status === 401) {
        clearStoredDashboardPassword();
        setLoginError("Onjuist wachtwoord");
        return;
      }
      if (!response.ok) {
        setLoginError("Kon stats niet laden");
        return;
      }
      const json = (await response.json()) as DashboardData;
      setData(json);
      setBotWallet(json.botWallet ?? null);
      setError(null);
      setAuthenticated(true);
      setLastUpdated(new Date().toISOString());
    } catch {
      setLoginError("Kon stats niet laden");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearStoredDashboardPassword();
    setAuthenticated(false);
    setData(null);
    setPasswordInput("");
  }

  async function toggleBot() {
    setActionLoading(true);
    try {
      const response = await fetch(
        "/api/bot/toggle",
        dashboardFetchInit({ method: "POST" }),
      );
      if (!response.ok) throw new Error("Toggle mislukt");
      setFeedback({ tone: "ok", message: "Bot-status bijgewerkt" });
      await fetchStats();
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Toggle mislukt",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function setupWebhook() {
    setActionLoading(true);
    try {
      const response = await fetch(
        "/api/setup/webhook",
        dashboardFetchInit({ method: "POST" }),
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Webhook setup mislukt");
      }
      setFeedback({ tone: "ok", message: "Webhook geregistreerd" });
      await fetchStats();
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Webhook setup mislukt",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleTarget(address: string, enabled: boolean) {
    setBusyTarget(address);
    try {
      const response = await fetch(
        "/api/targets/toggle",
        dashboardFetchInit({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, enabled }),
        }),
      );
      if (!response.ok) throw new Error("Target bijwerken mislukt");
      setFeedback({
        tone: "ok",
        message: enabled ? "Target ingeschakeld" : "Target uitgeschakeld",
      });
      await fetchStats();
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Target bijwerken mislukt",
      });
    } finally {
      setBusyTarget(null);
    }
  }

  async function addTargetWallet(address: string, label: string) {
    setAddBusy(true);
    try {
      const response = await fetch(
        "/api/targets/add",
        dashboardFetchInit({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, label, requireActivity: false }),
        }),
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Wallet toevoegen mislukt");
      }
      const swaps = json.activity?.swapCount ?? 0;
      setFeedback({
        tone: "ok",
        message: `Wallet toegevoegd (${swaps} recente swaps gevonden)`,
      });
      await fetchStats();
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Wallet toevoegen mislukt",
      });
    } finally {
      setAddBusy(false);
    }
  }

  async function removeTargetWallet(address: string) {
    setBusyTarget(address);
    try {
      const response = await fetch(
        "/api/targets/remove",
        dashboardFetchInit({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        }),
      );
      if (!response.ok) throw new Error("Verwijderen mislukt");
      setFeedback({ tone: "ok", message: "Wallet verwijderd" });
      await fetchStats();
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Verwijderen mislukt",
      });
    } finally {
      setBusyTarget(null);
    }
  }

  async function handleManualSell(positionId: string) {
    if (!data) return;
    const position = data.positions.find((p) => p.id === positionId);
    if (!position) return;

    const modeLabel =
      data.stats.mode === "live" ? "LIVE verkopen" : "DRY RUN simuleren";
    const confirmed = window.confirm(
      `${modeLabel}: volledige positie sluiten voor ${position.symbol ?? position.mint.slice(0, 8)}…?`,
    );
    if (!confirmed) return;

    setSellingPositionId(positionId);
    try {
      const response = await fetch(
        "/api/positions/sell",
        dashboardFetchInit({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positionId }),
        }),
      );
      const json = (await response.json()) as {
        ok?: boolean;
        error?: string;
        pnlSol?: number;
        dryRun?: boolean;
      };

      if (!response.ok) {
        throw new Error(json.error ?? "Verkopen mislukt");
      }

      const pnl =
        typeof json.pnlSol === "number"
          ? `${json.pnlSol >= 0 ? "+" : ""}${json.pnlSol.toFixed(4)} SOL`
          : "";
      setFeedback({
        tone: "ok",
        message: json.dryRun
          ? `[DRY RUN] Positie gesloten${pnl ? ` (${pnl})` : ""}`
          : `Positie verkocht${pnl ? ` (${pnl})` : ""}`,
      });
      await fetchStats();
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Verkopen mislukt",
      });
    } finally {
      setSellingPositionId(null);
    }
  }

  async function exportHistory() {
    try {
      const response = await fetch(
        "/api/export/positions",
        dashboardFetchInit(),
      );
      if (!response.ok) throw new Error("Export mislukt");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `positions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Export mislukt",
      });
    }
  }

  if (!authenticated && !loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6"
        >
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">
            Solana Copy Bot
          </p>
          <h1 className="mt-2 text-xl font-semibold text-white">Dashboard login</h1>
          <p className="mt-2 text-sm text-slate-400">
            Voer het dashboard-wachtwoord in.
          </p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-500"
            placeholder="Wachtwoord"
            autoComplete="current-password"
          />
          {loginError && <p className="mt-2 text-sm text-red-400">{loginError}</p>}
          <button
            type="submit"
            disabled={!passwordInput.trim() || loading}
            className="mt-4 w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            Inloggen
          </button>
        </form>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-red-300">
        <p>{error}</p>
        <button
          onClick={fetchStats}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
        >
          Opnieuw proberen
        </button>
      </div>
    );
  }

  if (!data) return null;

  const {
    stats,
    positions,
    openPositionMarks,
    recentEvents,
    targets,
    config,
    derivedStats,
    targetPerformance,
    pnlTimeline,
    health,
  } = data;
  const solPriceEur = stats.solPriceEur ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <HeaderActions
        stats={stats}
        solPriceEur={solPriceEur}
        lastUpdated={lastUpdated}
        actionLoading={actionLoading}
        feedback={feedback}
        onToggle={toggleBot}
        onWebhook={setupWebhook}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onLogout={handleLogout}
      />
      <TabNav active={tab} onChange={setTab} />

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        {tab === "overview" && (
          <>
            <KpiGrid
              stats={stats}
              derived={derivedStats}
              config={config}
              solPriceEur={solPriceEur}
            />
            <section className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <BotStatusCard
                  stats={stats}
                  config={config}
                  botWallet={botWallet}
                />
              </div>
              <div className="lg:col-span-2">
                <TargetsTable
                  targets={targets}
                  onToggle={toggleTarget}
                  onAdd={addTargetWallet}
                  onRemove={removeTargetWallet}
                  busyAddress={busyTarget}
                  addBusy={addBusy}
                />
              </div>
            </section>
            <PnlTimeline points={pnlTimeline} solPriceEur={solPriceEur} />
          </>
        )}

        {tab === "positions" && (
          <>
            <OpenPositions
              positions={positions}
              marks={openPositionMarks}
              targets={targets}
              solPriceEur={solPriceEur}
              mode={stats.mode}
              sellingPositionId={sellingPositionId}
              onSell={handleManualSell}
            />
            <TargetPerformanceTable
              performance={targetPerformance}
              solPriceEur={solPriceEur}
            />
          </>
        )}

        {tab === "history" && (
          <>
            <div className="flex justify-end">
              <button
                onClick={exportHistory}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
              >
                Export historie (CSV)
              </button>
            </div>
            <HistoryTable positions={positions} solPriceEur={solPriceEur} />
          </>
        )}

        {tab === "logs" && <EventFeed events={recentEvents} />}

        {tab === "settings" && (
          <>
            <SystemHealth health={health} />
            <SettingsPanel
              config={config}
              botWallet={botWallet}
              onToggle={toggleBot}
              onWebhook={setupWebhook}
              actionLoading={actionLoading}
              botEnabled={stats.botEnabled}
            />
          </>
        )}
      </main>
    </div>
  );
}
