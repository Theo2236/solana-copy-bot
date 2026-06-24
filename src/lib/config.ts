export function getConfig() {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const pokemonKey = process.env.POKEMON_TCG_API_KEY?.trim();

  const maxCards = Number.parseInt(process.env.MAX_CARDS_PER_SCAN ?? "12", 10);

  return {
    geminiKey,
    openaiKey,
    pokemonKey,
    maxCards: Number.isFinite(maxCards) && maxCards > 0 ? maxCards : 12,
    hasVisionProvider: Boolean(geminiKey || openaiKey),
    preferredVisionProvider: geminiKey ? ("gemini" as const) : openaiKey ? ("openai" as const) : null,
  };
}
