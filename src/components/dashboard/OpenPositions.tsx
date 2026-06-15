"use client";

import { useMemo } from "react";
import type { Position, TargetWallet } from "@/lib/types";
import { formatDuration, formatSol, formatTime, makeToEur } from "./format";
import { EmptyState, ExplorerLink } from "./ui";

interface OpenPositionsProps {
  positions: Position[];
  targets: TargetWallet[];
  solPriceEur: number | null;
}

export function OpenPositions({
  positions,
  targets,
  solPriceEur,
}: OpenPositionsProps) {
  const toEur = makeToEur(solPriceEur);
  const labelByAddress = useMemo(() => {
    const map = new Map<string, string>();
    for (const target of targets) map.set(target.address, target.label);
    return map;
  }, [targets]);

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
      <div className="mt-4 space-y-3">
        {open.map((position) => (
          <div
            key={position.id}
            className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">
                {position.symbol ?? "Token"}
              </span>
              <ExplorerLink value={position.mint} kind="token" />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-slate-400">
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
                  <ExplorerLink value={position.sourceWallet} kind="address" />
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
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
