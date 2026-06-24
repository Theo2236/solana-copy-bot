"use client";

import type { ScanResponse } from "@/lib/types";
import {
  bestMarketPrice,
  conditionLabel,
  formatUsd,
  statusColor,
  statusLabel,
} from "@/lib/format";

type ScanResultsProps = {
  result: ScanResponse;
};

export function ScanResults({ result }: ScanResultsProps) {
  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Gedetecteerd" value={String(result.summary.totalDetected)} />
        <SummaryCard label="Matches" value={String(result.summary.matched)} accent="emerald" />
        <SummaryCard label="Gedeeltelijk" value={String(result.summary.partial)} accent="amber" />
        <SummaryCard
          label="Totale marktwaarde"
          value={formatUsd(result.summary.totalMarketValue)}
          accent="yellow"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Gevonden kaarten</h2>
          <p className="text-sm text-white/60">
            Gescand op {new Date(result.scannedAt).toLocaleString("nl-NL")} via {result.provider}
          </p>
        </div>

        <div className="divide-y divide-white/10">
          {result.cards.map((card) => {
            const market = bestMarketPrice(card);
            return (
              <article key={`${card.detected.index}-${card.detected.name}`} className="flex gap-4 p-5">
                <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-900/80">
                  {card.card?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.card.imageUrl}
                      alt={card.card.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl">🃏</div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white">
                      {card.card?.name ?? card.detected.name}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusColor(card.matchStatus)}`}
                    >
                      {statusLabel(card.matchStatus)}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-white/70">
                    {card.card
                      ? `${card.card.set} · #${card.card.number} · ${card.card.rarity}`
                      : `Gedetecteerd: ${card.detected.name}`}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/50">
                    <span>Conditie: {conditionLabel(card.detected.condition)}</span>
                    <span>Zekerheid: {Math.round(card.detected.confidence * 100)}%</span>
                    {card.detected.notes && <span>{card.detected.notes}</span>}
                  </div>

                  {card.error && <p className="mt-2 text-sm text-rose-300">{card.error}</p>}
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs uppercase tracking-wide text-white/50">Marktprijs</p>
                  <p className="text-xl font-bold text-yellow-300">{formatUsd(market)}</p>
                  {card.card?.tcgplayerUrl && (
                    <a
                      href={card.card.tcgplayerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-sky-300 hover:underline"
                    >
                      TCGPlayer →
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: string;
  accent?: "slate" | "emerald" | "amber" | "yellow";
}) {
  const accents = {
    slate: "border-white/10",
    emerald: "border-emerald-500/30",
    amber: "border-amber-500/30",
    yellow: "border-yellow-400/40",
  };

  return (
    <div className={`rounded-xl border bg-white/5 p-4 ${accents[accent]}`}>
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
