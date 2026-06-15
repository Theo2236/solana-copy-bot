"use client";

import { useMemo, useState } from "react";
import type { Position } from "@/lib/types";
import {
  CLOSE_REASON_LABELS,
  formatDuration,
  formatSignedSol,
  formatTime,
  makeToEur,
} from "./format";
import { EmptyState, ExplorerLink, InfoBadge } from "./ui";

type SortKey = "recent" | "pnl";
type ReasonFilter = "all" | NonNullable<Position["closeReason"]>;

const REASON_FILTERS: { key: ReasonFilter; label: string }[] = [
  { key: "all", label: "Alle redenen" },
  { key: "take_profit", label: "Take profit" },
  { key: "stop_loss", label: "Stop loss" },
  { key: "copy_sell", label: "Copy sell" },
  { key: "manual", label: "Handmatig" },
];

interface HistoryTableProps {
  positions: Position[];
  solPriceEur: number | null;
}

export function HistoryTable({ positions, solPriceEur }: HistoryTableProps) {
  const toEur = makeToEur(solPriceEur);
  const [sort, setSort] = useState<SortKey>("recent");
  const [reason, setReason] = useState<ReasonFilter>("all");

  const closed = useMemo(
    () => positions.filter((p) => p.status === "closed"),
    [positions],
  );

  const rows = useMemo(() => {
    const filtered =
      reason === "all"
        ? closed
        : closed.filter((p) => p.closeReason === reason);
    const sorted = [...filtered];
    if (sort === "pnl") {
      sorted.sort((a, b) => (b.pnlSol ?? 0) - (a.pnlSol ?? 0));
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.closedAt ?? b.openedAt).getTime() -
          new Date(a.closedAt ?? a.openedAt).getTime(),
      );
    }
    return sorted;
  }, [closed, reason, sort]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Historie</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as ReasonFilter)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300"
          >
            {REASON_FILTERS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300"
          >
            <option value="recent">Nieuwste eerst</option>
            <option value="pnl">Hoogste PnL</option>
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Geen gesloten posities"
            hint="Zodra een positie sluit verschijnt die hier met PnL en reden."
          />
        </div>
      ) : (
        <>
          {/* Desktop tabel */}
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Token</th>
                  <th className="pb-3 pr-4">Inleg</th>
                  <th className="pb-3 pr-4">PnL</th>
                  <th className="pb-3 pr-4">Reden</th>
                  <th className="pb-3 pr-4">Duur</th>
                  <th className="pb-3">Gesloten</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((position) => {
                  const pnl = position.pnlSol ?? 0;
                  return (
                    <tr
                      key={position.id}
                      className="border-t border-slate-800"
                    >
                      <td className="py-3 pr-4">
                        <ExplorerLink value={position.mint} kind="token" />
                      </td>
                      <td className="py-3 pr-4">
                        {position.entrySol.toFixed(4)} SOL
                      </td>
                      <td
                        className={`py-3 pr-4 ${
                          pnl >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {formatSignedSol(pnl)}
                        <span className="ml-1 text-xs text-slate-500">
                          {toEur(pnl)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {position.closeReason
                          ? CLOSE_REASON_LABELS[position.closeReason]
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 text-slate-400">
                        {formatDuration(position.openedAt, position.closedAt)}
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

          {/* Mobiele cards */}
          <div className="mt-4 space-y-3 md:hidden">
            {rows.map((position) => {
              const pnl = position.pnlSol ?? 0;
              return (
                <div
                  key={position.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <ExplorerLink value={position.mint} kind="token" />
                    <span
                      className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}
                    >
                      {formatSignedSol(pnl)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <InfoBadge>
                      {position.closeReason
                        ? CLOSE_REASON_LABELS[position.closeReason]
                        : "—"}
                    </InfoBadge>
                    <span>
                      {formatDuration(position.openedAt, position.closedAt)}
                    </span>
                    <span>{formatTime(position.closedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
