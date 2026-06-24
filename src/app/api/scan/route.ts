import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { lookupCards, pickBestMarketPrice } from "@/lib/pokemon-tcg";
import { analyzeBulkPhoto } from "@/lib/vision";
import type { ScanResponse } from "@/lib/types";

const scanRequestSchema = z.object({
  image: z.string().min(100, "Afbeelding is te klein of ontbreekt"),
  mimeType: z
    .enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"])
    .default("image/jpeg"),
});

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const config = getConfig();

    if (!config.hasVisionProvider) {
      return NextResponse.json(
        {
          error:
            "Vision AI niet geconfigureerd. Voeg GEMINI_API_KEY of OPENAI_API_KEY toe.",
        },
        { status: 500 },
      );
    }

    const body = scanRequestSchema.parse(await request.json());
    const imageBase64 = body.image.replace(/^data:[^;]+;base64,/, "");

    const { cards: detected, provider } = await analyzeBulkPhoto({
      imageBase64,
      mimeType: body.mimeType,
      geminiKey: config.geminiKey,
      openaiKey: config.openaiKey,
      maxCards: config.maxCards,
    });

    if (!detected.length) {
      return NextResponse.json(
        { error: "Geen Pokémon kaarten gedetecteerd op deze foto." },
        { status: 422 },
      );
    }

    const matched = await lookupCards(detected, config.pokemonKey);

    const summary = {
      totalDetected: matched.length,
      matched: matched.filter((c) => c.matchStatus === "matched").length,
      partial: matched.filter((c) => c.matchStatus === "partial").length,
      notFound: matched.filter((c) => c.matchStatus === "not_found").length,
      totalMarketValue: matched.reduce((sum, item) => {
        if (!item.card?.prices.length) return sum;
        return sum + pickBestMarketPrice(item.card.prices);
      }, 0),
      currency: "USD" as const,
    };

    const response: ScanResponse = {
      id: randomUUID(),
      scannedAt: new Date().toISOString(),
      provider,
      cards: matched,
      summary,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ongeldige request", details: error.flatten() },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Onbekende serverfout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
