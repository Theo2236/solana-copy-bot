"use client";

import type { TargetWallet } from "@/lib/types";
import { ExplorerLink, InfoBadge } from "./ui";

interface TargetsTableProps {
  targets: TargetWallet[];
  onToggle?: (address: string, enabled: boolean) => void;
  busyAddress?: string | null;
}

export function TargetsTable({
  targets,
  onToggle,
  busyAddress,
}: TargetsTableProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Gevolgde wallets</h2>
        <InfoBadge
          tone="info"
          title="30d PnL en winrate zijn statische leaderboard-cijfers uit de config, geen live bot-resultaten."
        >
          Leaderboard (statisch)
        </InfoBadge>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="pb-3 pr-4">Trader</th>
              <th className="pb-3 pr-4">Adres</th>
              <th className="pb-3 pr-4">30d PnL*</th>
              <th className="pb-3 pr-4">Winrate*</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => (
              <tr key={target.address} className="border-t border-slate-800">
                <td className="py-3 pr-4 font-medium">{target.label}</td>
                <td className="py-3 pr-4">
                  <ExplorerLink value={target.address} kind="address" />
                </td>
                <td className="py-3 pr-4">+{target.pnl30dSol} SOL</td>
                <td className="py-3 pr-4">{target.winRate}%</td>
                <td className="py-3">
                  {onToggle ? (
                    <button
                      type="button"
                      disabled={busyAddress === target.address}
                      onClick={() => onToggle(target.address, !target.enabled)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                        target.enabled
                          ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {target.enabled ? "Actief" : "Uit"}
                    </button>
                  ) : (
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        target.enabled
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {target.enabled ? "Actief" : "Uit"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        * Statische leaderboard-cijfers uit de config — niet de live performance
        van deze bot.
      </p>
    </div>
  );
}
