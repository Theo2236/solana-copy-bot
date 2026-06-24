"use client";

import { useState } from "react";
import { ScannerUpload } from "@/components/ScannerUpload";
import { ScanResults } from "@/components/ScanResults";
import type { ScanResponse } from "@/lib/types";

export function BulkScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);

  async function handleScan(payload: { image: string; mimeType: string }) {
    setIsScanning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as ScanResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Scan mislukt");
      }

      setResult(data);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Onbekende fout");
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="text-center">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-yellow-300">
          AI Bulk Scanner
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Pokémon Kaart Scanner
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-white/70">
          Upload één foto met meerdere kaarten. Vision AI herkent elke kaart, zoekt ze op in de
          Pokémon TCG database en toont marktprijzen van TCGPlayer.
        </p>
      </header>

      <ScannerUpload onScan={handleScan} isScanning={isScanning} />

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-200">
          {error}
        </div>
      )}

      {result && <ScanResults result={result} />}

      <footer className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
        <p className="font-medium text-white">Tips voor betere resultaten</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Leg kaarten plat naast elkaar met goede belichting</li>
          <li>Zorg dat namen en kaartnummers leesbaar zijn</li>
          <li>Vermijd reflecties en sterke schaduwen</li>
          <li>Prijzen zijn indicatief (TCGPlayer marktprijs, USD)</li>
        </ul>
      </footer>
    </div>
  );
}
