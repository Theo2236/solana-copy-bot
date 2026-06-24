import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

export async function GET() {
  const config = getConfig();

  return NextResponse.json({
    status: "ok",
    visionProvider: config.preferredVisionProvider,
    pokemonApiConfigured: Boolean(config.pokemonKey),
    maxCardsPerScan: config.maxCards,
  });
}
