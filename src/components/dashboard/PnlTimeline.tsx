"use client";

import { useMemo } from "react";
import type { PnlPoint } from "@/lib/types";
import { formatSignedSol, makeToEur } from "./format";
import { EmptyState } from "./ui";

interface PnlTimelineProps {
  points: PnlPoint[];
  solPriceEur: number | null;
}

export function PnlTimeline({ points, solPriceEur }: PnlTimelineProps) {
  const toEur = makeToEur(solPriceEur);

  const { maxAbs, total } = useMemo(() => {
    let max = 0;
    let sum = 0;
    for (const p of points) {
      max = Math.max(max, Math.abs(p.pnlSol));
      sum += p.pnlSol;
    }
    return { maxAbs: max, total: sum };
  }, [points]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">PnL-tijdlijn</h2>
        <span
          className={`text-sm font-medium ${
            total >= 0 ? "text-emerald-400" : "text-red-400"
          }`}
        >
          Totaal {formatSignedSol(total)}{" "}
          <span className="text-xs text-slate-500">{toEur(total)}</span>
        </span>
      </div>

      {points.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nog geen gesloten trades"
            hint="Dagelijkse gerealiseerde PnL verschijnt hier zodra posities sluiten."
          />
        </div>
      ) : (
        <div className="mt-6 flex items-end gap-1 overflow-x-auto pb-2">
          {points.map((point) => {
            const heightPct =
              maxAbs > 0 ? Math.max(4, (Math.abs(point.pnlSol) / maxAbs) * 100) : 4;
            const positive = point.pnlSol >= 0;
            return (
              <div
                key={point.date}
                className="flex min-w-[28px] flex-1 flex-col items-center gap-1"
                title={`${point.date}: ${formatSignedSol(point.pnlSol)} (${point.trades} trades)`}
              >
                <div className="flex h-28 w-full items-end justify-center">
                  <div
                    className={`w-full rounded-t ${
                      positive ? "bg-emerald-500/70" : "bg-red-500/70"
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500">
                  {point.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
