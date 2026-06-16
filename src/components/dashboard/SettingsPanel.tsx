"use client";

import type { DashboardConfig } from "@/lib/types";
import { ExplorerLink, InfoBadge } from "./ui";

interface SettingsPanelProps {
  config: DashboardConfig;
  botWallet: string | null;
  onToggle: () => void;
  onWebhook: () => void;
  actionLoading: boolean;
  botEnabled: boolean;
}

export function SettingsPanel({
  config,
  botWallet,
  onToggle,
  onWebhook,
  actionLoading,
  botEnabled,
}: SettingsPanelProps) {
  const rows: { label: string; value: string; badge?: string }[] = [
    {
      label: "Copy size modus",
      value:
        config.copySizeMode === "conviction"
          ? `Conviction (wallet-ratio)`
          : "Fixed",
    },
    {
      label: "Basis trade size",
      value: `${config.tradeSizeSol} SOL`,
      badge:
        config.copySizeMode === "conviction"
          ? "bij referentie %"
          : undefined,
    },
    ...(config.copySizeMode === "conviction"
      ? [
          {
            label: "Referentie wallet-inzet",
            value: `${(config.referenceConvictionPct * 100).toFixed(0)}%`,
          },
          {
            label: "Min / max copy",
            value: `${config.minCopyTradeSol} – ${config.maxCopyTradeSol} SOL`,
          },
        ]
      : []),
    { label: "Max open posities", value: String(config.maxOpenPositions) },
    { label: "Stop loss", value: `-${config.stopLossPct}%` },
    {
      label: "Take profit",
      value:
        config.takeProfitPct > 0
          ? `+${config.takeProfitPct}%`
          : "Uit (exit via copy-sell)",
    },
    { label: "Max drawdown", value: `€${config.maxDrawdownEur}` },
    {
      label: "Min liquiditeit",
      value: `$${config.minLiquidityUsd.toLocaleString("nl-NL")}`,
    },
    {
      label: "Min token leeftijd",
      value: `${config.minTokenAgeHours}u`,
    },
    { label: "Slippage", value: `${config.slippageBps} bps` },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-medium">Configuratie</h2>
        <p className="mt-1 text-xs text-slate-500">
          Read-only — ingesteld via environment variables. Wijzig via je
          deployment, niet hier.
        </p>
        <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 border-b border-slate-800/60 pb-2"
            >
              <dt className="text-slate-400">{row.label}</dt>
              <dd className="flex items-center gap-2 text-slate-200">
                {row.value}
                {row.badge && (
                  <InfoBadge tone="warn">{row.badge}</InfoBadge>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-medium">Bot wallet & ingest</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-400">Bot wallet</dt>
            <dd>
              {botWallet ? (
                <ExplorerLink value={botWallet} kind="address" />
              ) : (
                <span className="text-slate-500">Niet geconfigureerd</span>
              )}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-slate-400">Realtime ingest</dt>
            <dd className="text-right text-slate-300">
              Helius webhook
              <p className="mt-1 text-xs text-slate-500">
                Backup poll: 1×/dag (Vercel Hobby cron)
              </p>
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={onToggle}
            disabled={actionLoading}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {botEnabled ? "Bot uitzetten" : "Bot aanzetten"}
          </button>
          <button
            onClick={onWebhook}
            disabled={actionLoading}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            Helius webhook registreren
          </button>
        </div>
      </div>
    </div>
  );
}
