"use client";

import { useMemo } from "react";
import type { OpenPositionMark, Position, TargetWallet } from "@/lib/types";
import {
  formatDuration,
  formatPct,
  formatSignedSol,
  formatSol,
  formatTime,
  makeToEur,
} from "./format";
import { EmptyState, ExplorerLink, PumpFunLink } from "./ui";

interface OpenPositionsProps {
  positions: Position[];
  marks: OpenPositionMark[];
  targets: TargetWallet[];
  solPriceEur: number | null;
  mode: "live" | "dry_run";
  sellingPositionId: string | null;
  onSell: (positionId: string) => void;
}

function pnlTone(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "text-slate-300";
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-slate-300";
}

export function OpenPositions({
  positions,
  marks,
  targets,
  solPriceEur,
  mode,
  sellingPositionId,
  onSell,
}: OpenPositionsProps) {
  const toEur = makeToEur(solPriceEur);
  const labelByAddress = useMemo(() => {
    const map = new Map<string, string>();
    for (const target of targets) map.set(target.address, target.label);
    return map;
  }, [targets]);

  const markByPositionId = useMemo(() => {
    const map = new Map<string, OpenPositionMark>();
    for (const mark of marks) map.set(mark.positionId, mark);
    return map;
  }, [marks]);

  const open = positions.filter((p) => p.status === "open");

  if (open.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-medium">Open posities</h2>
        <div className="mt-4">
          <EmptyState
            title="Geen open posities"
            hint="De bot wacht op een buy van een gevolgde wallet."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-medium">Open posities ({open.length})</h2>
      <p className="mt-1 text-xs text-slate-500">
        Live P&amp;L via actuele sell-quote — ververst elke 15 seconden.
      </p>
      <div className="mt-4 space-y-3">
        {open.map((position) => {
          const mark = markByPositionId.get(position.id);
          const livePnlSol = mark?.pnlSol ?? null;
          const livePnlPct = mark?.pnlPct ?? null;
          const currentValueSol = mark?.currentValueSol ?? null;

          return (
            <div
              key={position.id}
              className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {position.symbol ?? "Token"}
                  {(position.buyCount ?? 1) > 1 && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      {position.buyCount}× gekocht
                    </span>
                  )}
                  {(position.sellCount ?? 0) > 0 && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                      {position.sellCount}× deels verkocht
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <PumpFunLink mint={position.mint} />
                  <ExplorerLink value={position.mint} kind="token" />
                </span>
              </div>

              <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-900/50 px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs text-slate-500">Live P&amp;L</span>
                  <span
                    className={`text-base font-semibold tabular-nums ${pnlTone(livePnlSol)}`}
                  >
                    {livePnlSol !== null ? formatSignedSol(livePnlSol) : "—"}
                    {livePnlPct !== null && (
                      <span className="ml-2 text-sm font-medium">
                        ({livePnlPct >= 0 ? "+" : ""}
                        {formatPct(livePnlPct)})
                      </span>
                    )}
                  </span>
                </div>
                {livePnlSol !== null && (
                  <p className="mt-1 text-right text-xs text-slate-500">
                    {toEur(livePnlSol)}
                  </p>
                )}
                {livePnlSol === null && (
                  <p className="mt-1 text-right text-xs text-slate-500">
                    Geen live quote beschikbaar
                  </p>
                )}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-slate-400">
                <dt>Huidige waarde</dt>
                <dd className="text-right text-slate-200">
                  {currentValueSol !== null ? (
                    <>
                      {formatSol(currentValueSol)}{" "}
                      <span className="text-slate-500">
                        ({toEur(currentValueSol)})
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
                <dt>Inleg</dt>
                <dd className="text-right text-slate-200">
                  {formatSol(position.entrySol)}{" "}
                  <span className="text-slate-500">
                    ({toEur(position.entrySol)})
                  </span>
                </dd>
                <dt>Bron</dt>
                <dd className="text-right">
                  {labelByAddress.get(position.sourceWallet) ?? (
                    <ExplorerLink
                      value={position.sourceWallet}
                      kind="address"
                    />
                  )}
                </dd>
                <dt>Geopend</dt>
                <dd className="text-right text-slate-200">
                  {formatTime(position.openedAt)}
                </dd>
                <dt>Duur open</dt>
                <dd className="text-right text-slate-200">
                  {formatDuration(position.openedAt)}
                </dd>
                {mark?.quoteSource && (
                  <>
                    <dt>Quote</dt>
                    <dd className="text-right text-slate-500">
                      {mark.quoteSource === "pump_bonding_curve"
                        ? "pump.fun curve"
                        : "Jupiter"}
                    </dd>
                  </>
                )}
              </dl>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => onSell(position.id)}
                  disabled={sellingPositionId === position.id}
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sellingPositionId === position.id
                    ? "Verkopen…"
                    : mode === "dry_run"
                      ? "Simuleer sell"
                      : "Handmatig verkopen"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
