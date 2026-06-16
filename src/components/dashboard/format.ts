import type { Position, TradeEvent } from "@/lib/types";

function isDisplayNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function formatSol(value: number): string {
  if (!isDisplayNumber(value)) return "—";
  return `${value.toFixed(4)} SOL`;
}

export function formatSignedSol(value: number): string {
  if (!isDisplayNumber(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)} SOL`;
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSignedEur(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatEur(value)}`;
}

export function formatPct(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatTime(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Korte relatieve duur, bv. "3u 12m" of "45m". */
export function formatDuration(fromIso?: string, toIso?: string): string {
  if (!fromIso) return "—";
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  if (Number.isNaN(from) || Number.isNaN(to)) return "—";
  const minutes = Math.max(0, Math.round((to - from) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest > 0 ? `${hours}u ${rest}m` : `${hours}u`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `${days}d ${restHours}u` : `${days}d`;
}

export function makeToEur(solPriceEur: number | null) {
  return (sol: number): string => {
    if (!isDisplayNumber(sol) || solPriceEur === null || !isDisplayNumber(solPriceEur)) {
      return "—";
    }
    return formatEur(sol * solPriceEur);
  };
}

export const EVENT_STYLES: Record<
  TradeEvent["type"],
  { label: string; className: string }
> = {
  copy_buy: { label: "Buy", className: "bg-emerald-500/10 text-emerald-400" },
  copy_sell: { label: "Sell", className: "bg-sky-500/10 text-sky-400" },
  webhook_received: {
    label: "Signaal",
    className: "bg-indigo-500/10 text-indigo-400",
  },
  skip: { label: "Skip", className: "bg-amber-500/10 text-amber-400" },
  error: { label: "Fout", className: "bg-red-500/10 text-red-400" },
  cron_poll: { label: "Systeem", className: "bg-slate-700/40 text-slate-400" },
  position_close: {
    label: "Close",
    className: "bg-purple-500/10 text-purple-400",
  },
};

export const CLOSE_REASON_LABELS: Record<
  NonNullable<Position["closeReason"]>,
  string
> = {
  take_profit: "Take profit",
  stop_loss: "Stop loss",
  copy_sell: "Copy sell",
  manual: "Handmatig",
};
