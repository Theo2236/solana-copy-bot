"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardData } from "@/lib/types";

function formatSol(value: number): string {
  return `${value.toFixed(4)} SOL`;
}

function shortAddress(value: string): string {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatTime(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("nl-NL");
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [botWallet, setBotWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/stats", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Kon stats niet laden");
      }
      const json = (await response.json()) as DashboardData & {
        botWallet?: string | null;
      };
      setData(json);
      setBotWallet(json.botWallet ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  async function toggleBot() {
    setActionLoading(true);
    try {
      await fetch("/api/bot/toggle", { method: "POST" });
      await fetchStats();
    } finally {
      setActionLoading(false);
    }
  }

  async function setupWebhook() {
    setActionLoading(true);
    try {
      const response = await fetch("/api/setup/webhook", { method: "POST" });
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">
              Solana Copy Bot
            </p>
            <h1 className="text-2xl font-semibold">Monitoring Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">
              24/7 via Vercel · modus{" "}
              <span className="font-medium text-white">
                {stats.mode === "live" ? "LIVE" : "DRY RUN"}
              </span>
            </p>
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
            { label: "Bot saldo", value: formatSol(stats.balanceSol) },
            { label: "Open posities", value: String(stats.openPositions) },
            { label: "Trades vandaag", value: String(stats.tradesToday) },
            {
              label: "Realized PnL",
              value: formatSol(stats.realizedPnlSol),
              accent: stats.realizedPnlSol >= 0 ? "text-emerald-400" : "text-red-400",
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
                    <p className="font-mono text-xs">{shortAddress(position.mint)}</p>
                    <p className="mt-2 text-slate-300">
                      Entry: {formatSol(position.entrySol)}
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
                recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium uppercase text-emerald-400">
                        {event.type}
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
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
