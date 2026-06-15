"use client";

import { useMemo, useState } from "react";
import type { TradeEvent } from "@/lib/types";
import { EVENT_STYLES, formatTime } from "./format";
import { EmptyState, ExplorerLink } from "./ui";

type FilterKey = "all" | "trades" | "skips" | "errors" | "system";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Alles" },
  { key: "trades", label: "Trades" },
  { key: "skips", label: "Skips" },
  { key: "errors", label: "Errors" },
  { key: "system", label: "Systeem" },
];

function matchesFilter(event: TradeEvent, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "trades":
      return event.type === "copy_buy" || event.type === "copy_sell";
    case "skips":
      return event.type === "skip";
    case "errors":
      return event.type === "error";
    case "system":
      return (
        event.type === "cron_poll" ||
        event.type === "webhook_received" ||
        event.type === "position_close"
      );
    default:
      return true;
  }
}

export function EventFeed({ events }: { events: TradeEvent[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(
    () => events.filter((event) => matchesFilter(event, filter)),
    [events, filter],
  );

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Activiteit</h2>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === item.key
                  ? "bg-slate-200 text-slate-900"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {filtered.length === 0 ? (
          <EmptyState
            title="Geen events in deze filter"
            hint="Wissel van filter of wacht op nieuwe activiteit."
          />
        ) : (
          filtered.map((event) => {
            const style = EVENT_STYLES[event.type];
            const mode = event.metadata?.mode;
            return (
              <div
                key={event.id}
                className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style.className}`}
                  >
                    {style.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
                <p className="text-slate-200">{event.message}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  {event.wallet && (
                    <span className="inline-flex items-center gap-1">
                      Wallet: <ExplorerLink value={event.wallet} kind="address" />
                    </span>
                  )}
                  {event.mint && (
                    <span className="inline-flex items-center gap-1">
                      Token: <ExplorerLink value={event.mint} kind="token" />
                    </span>
                  )}
                  {event.txSignature && (
                    <span className="inline-flex items-center gap-1">
                      Tx: <ExplorerLink value={event.txSignature} kind="tx" />
                    </span>
                  )}
                  {typeof mode === "string" && (
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                      {mode}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
