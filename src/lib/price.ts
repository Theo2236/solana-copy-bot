let cachedPrice: { eur: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getSolPriceEur(): Promise<number | null> {
  if (cachedPrice && Date.now() - cachedPrice.fetchedAt < CACHE_TTL_MS) {
    return cachedPrice.eur;
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=eur",
      { next: { revalidate: 60 } },
    );
    if (!response.ok) return cachedPrice?.eur ?? null;

    const json = (await response.json()) as { solana?: { eur?: number } };
    const eur = json.solana?.eur;
    if (typeof eur !== "number") return cachedPrice?.eur ?? null;

    cachedPrice = { eur, fetchedAt: Date.now() };
    return eur;
  } catch {
    return cachedPrice?.eur ?? null;
  }
}
