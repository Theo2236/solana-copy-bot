"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearStoredDashboardPassword,
  dashboardFetchInit,
  getStoredDashboardPassword,
  setStoredDashboardPassword,
} from "@/lib/dashboard-client";
import type { DashboardData, Position, TradeEvent } from "@/lib/types";

function formatSol(value: number): string {
  return `${value.toFixed(4)} SOL`;
}

function formatEur(value: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function shortAddress(value: string): string {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatTime(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EVENT_STYLES: Record<TradeEvent["type"], { label: string; className: string }> = {
  copy_buy: { label: "Buy", className: "bg-emerald-500/10 text-emerald-400" },
  copy_sell: { label: "Sell", className: "bg-sky-500/10 text-sky-400" },
  webhook_received: { label: "Signaal", className: "bg-indigo-500/10 text-indigo-400" },
  skip: { label: "Skip", className: "bg-amber-500/10 text-amber-400" },
  error: { label: "Fout", className: "bg-red-500/10 text-red-400" },
  cron_poll: { label: "Systeem", className: "bg-slate-700/40 text-slate-400" },
  position_close: { label: "Close", className: "bg-purple-500/10 text-purple-400" },
};

const CLOSE_REASON_LABELS: Record<NonNullable<Position["closeReason"]>, string> = {
  take_profit: "Take profit",
  stop_loss: "Stop loss",
  copy_sell: "Copy sell",
  manual: "Handmatig",
};

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [botWallet, setBotWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/stats", {
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
      const json = (await response.json()) as DashboardData & {
        botWallet?: string | null;
      };
      setData(json);
      setBotWallet(json.botWallet ?? null);
      setError(null);
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

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
      const json = (await response.json()) as DashboardData & {
        botWallet?: string | null;
      };
      setData(json);
      setBotWallet(json.botWallet ?? null);
      setError(null);
      setAuthenticated(true);
    } catch {
      setLoginError("Kon stats niet laden");
    } finally {
      setLoading(false);
    }
  }

  async function toggleBot() {
    setActionLoading(true);
    try {
      await fetch("/api/bot/toggle", dashboardFetchInit({ method: "POST" }));
      await fetchStats();
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
      alert(`Webhook actief: ${json.webhookUrl}`);
      await fetchStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Webhook setup mislukt");
    } finally {
      setActionLoading(false);
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
          {loginError && (
            <p className="mt-2 text-sm text-red-400">{loginError}</p>
          )}
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Dashboard laden...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-red-300">
        {error ?? "Geen data"}
      </div>
    );
  }

  const { stats, positions, recentEvents, targets, config } = data;
  const openPositions = positions.filter((p) => p.status === "open");
  const closedPositions = positions
    .filter((p) => p.status === "closed")
    .sort(
      (a, b) =>
        new Date(b.closedAt ?? b.openedAt).getTime() -
        new Date(a.closedAt ?? a.openedAt).getTime(),
    );
  const solPriceEur = stats.solPriceEur ?? null;
  const toEur = (sol: number): string =>
    solPriceEur !== null ? formatEur(sol * solPriceEur) : "—";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">
              Solana Copy Bot
            </p>
            <h1 className="text-2xl font-semibold">Monitoring Dashboard</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  stats.mode === "live"
                    ? "bg-red-500/10 text-red-400"
                    : "bg-amber-500/10 text-amber-400"
                }`}
              >
                {stats.mode === "live" ? "LIVE" : "DRY RUN"}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  stats.botEnabled
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {stats.botEnabled ? "Actief" : "Gestopt"}
              </span>
              {solPriceEur !== null && (
                <span className="text-xs text-slate-400">
                  1 SOL = {formatEur(solPriceEur)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={toggleBot}
              disabled={actionLoading}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {stats.botEnabled ? "Bot uitzetten" : "Bot aanzetten"}
            </button>
            <button
              onClick={setupWebhook}
              disabled={actionLoading}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              Helius webhook registreren
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Bot saldo",
              value: formatSol(stats.balanceSol),
              sub: toEur(stats.balanceSol),
            },
            {
              label: "Winst (EUR)",
              value: toEur(stats.realizedPnlSol),
              sub: formatSol(stats.realizedPnlSol),
              accent:
                stats.realizedPnlSol >= 0 ? "text-emerald-400" : "text-red-400",
            },
            {
              label: "Open posities",
              value: String(stats.openPositions),
              sub: `max ${config.maxOpenPositions}`,
            },
            {
              label: "Trades vandaag",
              value: String(stats.tradesToday),
              sub: `max ${config.maxTradesPerDay} per dag`,
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">{card.label}</p>
              <p className={`mt-2 text-2xl font-semibold ${card.accent ?? ""}`}>
                {card.value}
              </p>
              <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-1">
            <h2 className="text-lg font-medium">Bot status</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Status</dt>
                <dd>{stats.botEnabled ? "Actief" : "Gestopt"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Wallet</dt>
                <dd className="font-mono text-xs">
                  {botWallet ? shortAddress(botWallet) : "Niet geconfigureerd"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Wins / Losses</dt>
                <dd>
                  {stats.wins} / {stats.losses}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Laatste event</dt>
                <dd>{formatTime(stats.lastEventAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Uptime sinds</dt>
                <dd>{formatTime(stats.uptimeSince)}</dd>
              </div>
            </dl>

            <div className="mt-6 rounded-xl bg-slate-950 p-4 text-sm">
              <p className="font-medium">Risico-instellingen</p>
              <ul className="mt-3 space-y-2 text-slate-400">
                <li>Trade size: {config.tradeSizeSol} SOL</li>
                <li>Max posities: {config.maxOpenPositions}</li>
                <li>Max trades/dag: {config.maxTradesPerDay}</li>
                <li>SL / TP: -{config.stopLossPct}% / +{config.takeProfitPct}%</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
            <h2 className="text-lg font-medium">Gevolgde wallets</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pb-3 pr-4">Trader</th>
                    <th className="pb-3 pr-4">Adres</th>
                    <th className="pb-3 pr-4">30d PnL</th>
                    <th className="pb-3 pr-4">Winrate</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((target) => (
                    <tr key={target.address} className="border-t border-slate-800">
                      <td className="py-3 pr-4 font-medium">{target.label}</td>
                      <td className="py-3 pr-4 font-mono text-xs">
                        {shortAddress(target.address)}
                      </td>
                      <td className="py-3 pr-4">+{target.pnl30dSol} SOL</td>
                      <td className="py-3 pr-4">{target.winRate}%</td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            target.enabled
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {target.enabled ? "Actief" : "Uit"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-medium">Open posities</h2>
            {openPositions.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">Geen open posities.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {openPositions.map((position) => (
                  <div
                    key={position.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-xs">
                        {position.symbol ?? shortAddress(position.mint)}
                      </p>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                        Open
                      </span>
                    </div>
                    <p className="mt-2 text-slate-300">
                      Entry: {formatSol(position.entrySol)}{" "}
                      <span className="text-slate-500">
                        ({toEur(position.entrySol)})
                      </span>
                    </p>
                    <p className="text-slate-400">
                      Bron: {shortAddress(position.sourceWallet)} ·{" "}
                      {formatTime(position.openedAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-medium">Recente events</h2>
            <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">
              {recentEvents.length === 0 ? (
                <p className="text-sm text-slate-400">Nog geen events.</p>
              ) : (
                recentEvents.map((event) => {
                  const style = EVENT_STYLES[event.type] ?? {
                    label: event.type,
                    className: "bg-slate-800 text-slate-400",
                  };
                  return (
                    <div
                      key={event.id}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}
                        >
                          {style.label}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                      <p className="mt-2 text-slate-300">{event.message}</p>
                      {event.mint && (
                        <p className="mt-1 font-mono text-xs text-slate-500">
                          {shortAddress(event.mint)}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium">Positie-historie</h2>
            <span className="text-sm text-slate-400">
              {closedPositions.length} gesloten
            </span>
          </div>
          {closedPositions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              Nog geen gesloten posities.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pb-3 pr-4">Token</th>
                    <th className="pb-3 pr-4">Entry</th>
                    <th className="pb-3 pr-4">Exit</th>
                    <th className="pb-3 pr-4">PnL</th>
                    <th className="pb-3 pr-4">PnL (EUR)</th>
                    <th className="pb-3 pr-4">Reden</th>
                    <th className="pb-3 pr-4">Geopend</th>
                    <th className="pb-3">Gesloten</th>
                  </tr>
                </thead>
                <tbody>
                  {closedPositions.map((position) => {
                    const pnl = position.pnlSol ?? 0;
                    const pnlColor =
                      pnl > 0
                        ? "text-emerald-400"
                        : pnl < 0
                          ? "text-red-400"
                          : "text-slate-300";
                    return (
                      <tr
                        key={position.id}
                        className="border-t border-slate-800"
                      >
                        <td className="py-3 pr-4 font-mono text-xs">
                          {position.symbol ?? shortAddress(position.mint)}
                        </td>
                        <td className="py-3 pr-4">{formatSol(position.entrySol)}</td>
                        <td className="py-3 pr-4">
                          {position.exitSol !== undefined
                            ? formatSol(position.exitSol)
                            : "—"}
                        </td>
                        <td className={`py-3 pr-4 font-medium ${pnlColor}`}>
                          {pnl >= 0 ? "+" : ""}
                          {formatSol(pnl)}
                        </td>
                        <td className={`py-3 pr-4 font-medium ${pnlColor}`}>
                          {solPriceEur !== null
                            ? `${pnl >= 0 ? "+" : ""}${formatEur(pnl * solPriceEur)}`
                            : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          {position.closeReason
                            ? CLOSE_REASON_LABELS[position.closeReason]
                            : "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-400">
                          {formatTime(position.openedAt)}
                        </td>
                        <td className="py-3 text-slate-400">
                          {formatTime(position.closedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
