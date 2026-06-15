"use client";

import type { TargetPerformance } from "@/lib/types";
import { formatSignedSol, formatTime, makeToEur } from "./format";
import { EmptyState, ExplorerLink, InfoBadge } from "./ui";

interface TargetPerformanceTableProps {
  performance: TargetPerformance[];
  solPriceEur: number | null;
}

export function TargetPerformanceTable({
  performance,
  solPriceEur,
}: TargetPerformanceTableProps) {
  const toEur = makeToEur(solPriceEur);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Performance per target</h2>
        <InfoBadge
          tone="info"
          title="Berekend uit echte bot-kopieën, los van het statische leaderboard."
        >
          Live bot-kopieën
        </InfoBadge>
      </div>

      {performance.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nog geen kopieën"
            hint="Zodra de bot een target kopieert verschijnt hier de performance."
          />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="pb-3 pr-4">Target</th>
                <th className="pb-3 pr-4">Trades</th>
                <th className="pb-3 pr-4">W / L</th>
                <th className="pb-3 pr-4">Open</th>
                <th className="pb-3 pr-4">PnL</th>
                <th className="pb-3">Laatste</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((row) => (
                <tr key={row.address} className="border-t border-slate-800">
                  <td className="py-3 pr-4">
                    <div className="flex flex-col">
                      <span className="text-slate-200">{row.label}</span>
                      <ExplorerLink value={row.address} kind="address" />
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-slate-300">{row.trades}</td>
                  <td className="py-3 pr-4 text-slate-300">
                    <span className="text-emerald-400">{row.wins}</span>
                    {" / "}
                    <span className="text-red-400">{row.losses}</span>
                  </td>
                  <td className="py-3 pr-4 text-slate-300">{row.openTrades}</td>
                  <td
                    className={`py-3 pr-4 ${
                      row.realizedPnlSol >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {formatSignedSol(row.realizedPnlSol)}
                    <span className="ml-1 text-xs text-slate-500">
                      {toEur(row.realizedPnlSol)}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400">
                    {formatTime(row.lastActivityAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
