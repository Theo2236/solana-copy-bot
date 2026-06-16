"use client";

import type { BotStats, DashboardConfig } from "@/lib/types";
import { formatTime } from "./format";
import { ExplorerLink, InfoBadge } from "./ui";

interface BotStatusCardProps {
  stats: BotStats;
  config: DashboardConfig;
  botWallet: string | null;
}

export function BotStatusCard({ stats, config, botWallet }: BotStatusCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Bot status</h2>
        <InfoBadge tone={stats.mode === "live" ? "danger" : "warn"}>
          {stats.mode === "live" ? "LIVE" : "DRY RUN"}
        </InfoBadge>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-400">Status</dt>
          <dd>{stats.botEnabled ? "Actief" : "Gestopt"}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-400">Wallet</dt>
          <dd>
            {botWallet ? (
              <ExplorerLink value={botWallet} kind="address" />
            ) : (
              <span className="text-slate-500">Niet geconfigureerd</span>
            )}
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
          <li>
            Copy size:{" "}
            {config.copySizeMode === "conviction"
              ? `conviction (basis ${config.tradeSizeSol} SOL bij ${(config.referenceConvictionPct * 100).toFixed(0)}% wallet-inzet)`
              : `fixed ${config.tradeSizeSol} SOL`}
          </li>
          {config.copySizeMode === "conviction" && (
            <li>
              Copy range: {config.minCopyTradeSol}–{config.maxCopyTradeSol} SOL
            </li>
          )}
          <li>Max posities: {config.maxOpenPositions}</li>
          <li>
            SL: -{config.stopLossPct}%
            {config.takeProfitPct > 0
              ? ` · TP: +${config.takeProfitPct}%`
              : " · geen take-profit (copy-sell)"}
          </li>
        </ul>
      </div>
    </div>
  );
}
