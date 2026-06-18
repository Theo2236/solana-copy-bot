"use client";

import { useState } from "react";
import {
  isPumpFunMint,
  pumpFunCoinUrl,
  solscanAddress,
  solscanToken,
  solscanTx,
  shortenAddress,
} from "@/lib/explorer";

export function CopyButton({
  value,
  label = "Kopieer",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard kan geblokkeerd zijn; stil falen
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`${label}: ${value}`}
      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
    >
      {copied ? "Gekopieerd" : label}
    </button>
  );
}

/** Afgekort adres als Solscan-link met kopieerknop ernaast. */
export function ExplorerLink({
  value,
  kind = "address",
  chars = 4,
  withCopy = true,
}: {
  value: string;
  kind?: ExplorerKind;
  chars?: number;
  withCopy?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <a
        href={explorerHref(kind, value)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs text-sky-400 underline-offset-2 hover:underline"
      >
        {shortenAddress(value, chars)}
      </a>
      {withCopy && <CopyButton value={value} label="kopieer" />}
    </span>
  );
}

type ExplorerKind = "address" | "token" | "tx";

function explorerHref(kind: ExplorerKind, value: string): string {
  if (kind === "token") return solscanToken(value);
  if (kind === "tx") return solscanTx(value);
  return solscanAddress(value);
}

/** Externe link naar pump.fun voor bonding-curve tokens. */
export function PumpFunLink({ mint }: { mint: string }) {
  if (!isPumpFunMint(mint)) return null;

  return (
    <a
      href={pumpFunCoinUrl(mint)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-medium text-fuchsia-300 underline-offset-2 hover:underline"
    >
      pump.fun
    </a>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/50 p-6 text-center">
      <p className="text-sm text-slate-300">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="h-3 w-24 rounded bg-slate-800" />
      <div className="mt-3 h-7 w-32 rounded bg-slate-800" />
      <div className="mt-2 h-3 w-20 rounded bg-slate-800" />
    </div>
  );
}

export function InfoBadge({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warn" | "info" | "danger";
  title?: string;
}) {
  const toneClass =
    tone === "warn"
      ? "bg-amber-500/10 text-amber-400"
      : tone === "info"
        ? "bg-sky-500/10 text-sky-400"
        : tone === "danger"
          ? "bg-red-500/10 text-red-400"
          : "bg-slate-800 text-slate-400";
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}
