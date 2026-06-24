"use client";

import { useCallback, useRef, useState } from "react";
import { fileToBase64 } from "@/lib/format";

type ScannerUploadProps = {
  onScan: (payload: { image: string; mimeType: string }) => Promise<void>;
  isScanning: boolean;
};

export function ScannerUpload({ onScan, isScanning }: ScannerUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!file.type.startsWith("image/")) {
        setError("Upload een afbeeldingsbestand (JPG, PNG of WebP).");
        return;
      }

      if (file.size > 12 * 1024 * 1024) {
        setError("Afbeelding is te groot (max 12 MB).");
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      try {
        const { base64, mimeType } = await fileToBase64(file);
        await onScan({ image: base64, mimeType });
      } catch {
        setError("Kon de afbeelding niet verwerken.");
      }
    },
    [onScan],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition ${
          dragOver
            ? "border-yellow-300 bg-yellow-300/10"
            : "border-white/20 hover:border-white/40 hover:bg-white/5"
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Preview van geüploade kaarten"
            className="max-h-72 w-full rounded-lg object-contain"
          />
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-400/20 text-3xl">
              📸
            </div>
            <h2 className="text-lg font-semibold text-white">Sleep of klik om te uploaden</h2>
            <p className="mt-2 max-w-md text-sm text-white/60">
              Leg tot 10–12 kaarten naast elkaar en maak één foto. De AI herkent elke kaart en
              haalt marktprijzen op.
            </p>
          </div>
        )}

        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/70">
            <div className="text-center">
              <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-yellow-300 border-t-transparent" />
              <p className="font-medium text-white">Kaarten analyseren…</p>
              <p className="text-sm text-white/60">Vision AI + prijslookup</p>
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
    </section>
  );
}
