"use client";

import type { BotStats } from "@/lib/types";
import { formatEur, formatTime } from "./format";
import { InfoBadge } from "./ui";

interface HeaderActionsProps {
  stats: BotStats;
  solPriceEur: number | null;
  lastUpdated: string | null;
  actionLoading: boolean;
  feedback: { tone: "ok" | "error"; message: string } | null;
  onToggle: () => void;
  onWebhook: () => void;
  onRefresh: () => void;
  onLogout: () => void;
  refreshing?: boolean;
}

export function HeaderActions({
  stats,
  solPriceEur,
  lastUpdated,
  actionLoading,
  feedback,
  onToggle,
  onWebhook,
  onRefresh,
  onLogout,
  refreshing = false,
}: HeaderActionsProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">
            Solana Copy Bot
          </p>
          <h1 className="text-2xl font-semibold">Monitoring Dashboard</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <InfoBadge tone={stats.mode === "live" ? "danger" : "warn"}>
              {stats.mode === "live" ? "LIVE" : "DRY RUN"}
            </InfoBadge>
            <InfoBadge tone={stats.botEnabled ? "info" : "neutral"}>
              {stats.botEnabled ? "Actief" : "Gestopt"}
            </InfoBadge>
            {solPriceEur !== null && (
              <span className="text-xs text-slate-400">
                1 SOL = {formatEur(solPriceEur)}
              </span>
            )}
            {lastUpdated && (
              <span className="text-xs text-slate-500">
                Bijgewerkt {formatTime(lastUpdated)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onRefresh}
              disabled={actionLoading || refreshing}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {refreshing ? "Bezig…" : "Refresh"}
            </button>
            <button
              onClick={onToggle}
              disabled={actionLoading}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {stats.botEnabled ? "Bot uitzetten" : "Bot aanzetten"}
            </button>
            <button
              onClick={onWebhook}
              disabled={actionLoading}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              Webhook
            </button>
            <button
              onClick={onLogout}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
          {feedback && (
            <p
              className={`text-xs ${
                feedback.tone === "ok" ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {feedback.message}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
