"use client";

import { useState } from "react";
import type { TargetWallet } from "@/lib/types";
import { ExplorerLink, InfoBadge } from "./ui";

interface TargetsTableProps {
  targets: TargetWallet[];
  onToggle?: (address: string, enabled: boolean) => void;
  onAdd?: (address: string, label: string) => Promise<void> | void;
  onRemove?: (address: string) => Promise<void> | void;
  busyAddress?: string | null;
  addBusy?: boolean;
}

export function TargetsTable({
  targets,
  onToggle,
  onAdd,
  onRemove,
  busyAddress,
  addBusy,
}: TargetsTableProps) {
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");

  async function submitAdd(event: React.FormEvent) {
    event.preventDefault();
    const addr = address.trim();
    if (!addr || !onAdd) return;
    await onAdd(addr, label.trim());
    setAddress("");
    setLabel("");
  }
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
              <th className="pb-3 pr-4">Status</th>
              {onRemove && <th className="pb-3"></th>}
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
                <td className="py-3 pr-4">
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
                {onRemove && (
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      disabled={busyAddress === target.address}
                      onClick={() => onRemove(target.address)}
                      className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                      title="Wallet verwijderen"
                    >
                      Verwijderen
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {onAdd && (
        <form
          onSubmit={submitAdd}
          className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-800 pt-4"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-400">Wallet-adres</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Solana adres..."
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white outline-none focus:border-emerald-500"
            />
          </div>
          <div className="w-32">
            <label className="text-xs text-slate-400">Naam (optioneel)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={!address.trim() || addBusy}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {addBusy ? "Bezig..." : "Wallet toevoegen"}
          </button>
        </form>
      )}
      <p className="mt-3 text-xs text-slate-500">
        * Statische leaderboard-cijfers uit de config — niet de live performance
        van deze bot.
      </p>
    </div>
  );
}
