"use client";

import type { HealthStatus } from "@/lib/types";
import { formatTime } from "./format";
import { InfoBadge } from "./ui";

function StatusRow({ label, ok, okText = "OK", failText = "Ontbreekt" }: {
  label: string;
  ok: boolean;
  okText?: string;
  failText?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <InfoBadge tone={ok ? "info" : "danger"}>
        {ok ? okText : failText}
      </InfoBadge>
    </div>
  );
}

export function SystemHealth({ health }: { health: HealthStatus }) {
  const silenceLabel =
    health.minutesSinceLastEvent === null
      ? "Nog geen events"
      : health.minutesSinceLastEvent < 60
        ? `${health.minutesSinceLastEvent}m geleden`
        : `${Math.floor(health.minutesSinceLastEvent / 60)}u geleden`;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Systeem status</h2>
        <InfoBadge tone={health.mode === "live" ? "danger" : "warn"}>
          {health.mode === "live" ? "LIVE" : "DRY RUN"}
        </InfoBadge>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <StatusRow
          label="Redis"
          ok={health.redisConfigured}
          okText="Verbonden"
          failText="Geheugen-fallback"
        />
        <StatusRow label="Helius API key" ok={health.heliusConfigured} />
        <StatusRow label="Bot wallet" ok={health.botWalletConfigured} />
        <StatusRow
          label="Webhook secret"
          ok={health.webhookSecretConfigured}
        />
        <StatusRow
          label="Cron secret"
          ok={health.cronSecretConfigured}
        />
        <StatusRow
          label="Dashboard wachtwoord"
          ok={health.dashboardPasswordConfigured}
        />
      </div>

      {health.authWarnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-400">
          <p className="font-medium text-red-300">Auth-configuratie</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {health.authWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={`mt-4 rounded-xl border p-4 text-sm ${
          health.silenceWarning
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-slate-800 bg-slate-950/40"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-400">Laatste activiteit</span>
          <span className="text-slate-200">{silenceLabel}</span>
        </div>
        {health.silenceWarning && (
          <p className="mt-2 text-xs text-amber-400">
            Geen events sinds {formatTime(health.lastEventAt)} — controleer of de
            Helius webhook nog binnenkomt.
          </p>
        )}
      </div>
    </div>
  );
}
