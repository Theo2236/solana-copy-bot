import type { CardCondition, MatchedCard, ScanResponse } from "@/lib/types";

export function formatUsd(value?: number): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function conditionLabel(condition: CardCondition): string {
  const labels: Record<CardCondition, string> = {
    mint: "Mint",
    near_mint: "Near Mint",
    lightly_played: "Lightly Played",
    moderately_played: "Moderately Played",
    heavily_played: "Heavily Played",
    damaged: "Damaged",
    unknown: "Onbekend",
  };
  return labels[condition];
}

export function statusLabel(status: MatchedCard["matchStatus"]): string {
  const labels = {
    matched: "Match",
    partial: "Gedeeltelijk",
    not_found: "Niet gevonden",
  };
  return labels[status];
}

export function statusColor(status: MatchedCard["matchStatus"]): string {
  const colors = {
    matched: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    partial: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    not_found: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  };
  return colors[status];
}

export function bestMarketPrice(card: ScanResponse["cards"][number]): number | undefined {
  const prices = card.card?.prices ?? [];
  let best: number | undefined;
  for (const price of prices) {
    const candidate = price.market ?? price.mid ?? price.low;
    if (candidate !== undefined && (best === undefined || candidate > best)) {
      best = candidate;
    }
  }
  return best;
}

export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return {
    base64: btoa(binary),
    mimeType: file.type || "image/jpeg",
  };
}
