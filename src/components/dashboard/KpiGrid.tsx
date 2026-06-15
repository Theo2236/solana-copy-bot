"use client";

import type { BotStats, DashboardConfig, DerivedStats } from "@/lib/types";
import {
  formatPct,
  formatSignedSol,
  formatSol,
  makeToEur,
} from "./format";

interface KpiGridProps {
  stats: BotStats;
  derived: DerivedStats;
  config: DashboardConfig;
  solPriceEur: number | null;
}

export function KpiGrid({ stats, derived, config, solPriceEur }: KpiGridProps) {
  const toEur = makeToEur(solPriceEur);

  const cards: {
    label: string;
    value: string;
    sub: string;
    accent?: string;
  }[] = [
    {
      label: "Bot saldo",
      value: formatSol(stats.balanceSol),
      sub: toEur(stats.balanceSol),
    },
    {
      label: "Gerealiseerde PnL",
      value: toEur(stats.realizedPnlSol),
      sub: formatSignedSol(stats.realizedPnlSol),
      accent: stats.realizedPnlSol >= 0 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: "Winrate",
      value: formatPct(derived.winRate),
      sub: `${stats.wins}W / ${stats.losses}L · ${derived.closedTrades} gesloten`,
    },
    {
      label: "Totaal trades",
      value: String(stats.totalTrades),
      sub: `${stats.tradesToday} vandaag · max ${config.maxTradesPerDay}/dag`,
    },
    {
      label: "Gem. PnL / trade",
      value:
        derived.avgPnlSol !== null ? formatSignedSol(derived.avgPnlSol) : "—",
      sub:
        derived.avgPnlSol !== null ? toEur(derived.avgPnlSol) : "Nog geen data",
      accent:
        derived.avgPnlSol === null
          ? undefined
          : derived.avgPnlSol >= 0
            ? "text-emerald-400"
            : "text-red-400",
    },
    {
      label: "PnL vandaag",
      value: formatSignedSol(derived.pnlTodaySol),
      sub: `Deze week: ${formatSignedSol(derived.pnlWeekSol)}`,
      accent: derived.pnlTodaySol >= 0 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: "Open exposure",
      value: formatSol(derived.openExposureSol),
      sub:
        derived.exposurePct !== null
          ? `${formatPct(derived.exposurePct)} van saldo · ${stats.openPositions}/${config.maxOpenPositions}`
          : `${stats.openPositions}/${config.maxOpenPositions} posities`,
    },
    {
      label: "Skips / errors (24u)",
      value: `${derived.skipCount24h} / ${derived.errorCount24h}`,
      sub: `${derived.copyCount24h} copy-events`,
      accent: derived.errorCount24h > 0 ? "text-red-400" : undefined,
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
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
  );
}
