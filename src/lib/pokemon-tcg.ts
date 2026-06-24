import type { CardPrice, DetectedCard, MatchedCard } from "./types";

const API_BASE = "https://api.pokemontcg.io/v2";

type TcgPlayerPrices = {
  normal?: { low?: number; mid?: number; high?: number; market?: number; directLow?: number };
  holofoil?: { low?: number; mid?: number; high?: number; market?: number; directLow?: number };
  reverseHolofoil?: { low?: number; mid?: number; high?: number; market?: number; directLow?: number };
  "1stEditionHolofoil"?: { low?: number; mid?: number; high?: number; market?: number; directLow?: number };
};

type PokemonCard = {
  id: string;
  name: string;
  number: string;
  rarity: string;
  set: { name: string };
  images?: { small?: string; large?: string };
  tcgplayer?: { url?: string; prices?: TcgPlayerPrices };
};

type SearchResponse = {
  data: PokemonCard[];
  totalCount: number;
};

function buildHeaders(apiKey?: string): HeadersInit {
  const headers: HeadersInit = { Accept: "application/json" };
  if (apiKey) headers["X-Api-Key"] = apiKey;
  return headers;
}

function escapeQuery(value: string): string {
  return value.replace(/"/g, '\\"');
}

export function buildSearchQuery(card: DetectedCard): string {
  const parts: string[] = [`name:"${escapeQuery(card.name)}"`];
  if (card.setName) parts.push(`set.name:"${escapeQuery(card.setName)}"`);
  if (card.cardNumber) {
    const numberOnly = card.cardNumber.split("/")[0]?.replace(/^0+/, "") ?? card.cardNumber;
    parts.push(`number:${numberOnly}`);
  }
  return parts.join(" ");
}

function toPrices(tcg?: TcgPlayerPrices): CardPrice[] {
  if (!tcg) return [];
  const entries: CardPrice[] = [];

  for (const [variant, values] of Object.entries(tcg)) {
    if (!values) continue;
    entries.push({
      variant,
      low: values.low,
      mid: values.mid,
      high: values.high,
      market: values.market,
      directLow: values.directLow,
    });
  }

  return entries;
}

export function pickBestMarketPrice(prices: CardPrice[]): number {
  let best = 0;
  for (const price of prices) {
    const candidate = price.market ?? price.mid ?? price.low ?? 0;
    if (candidate > best) best = candidate;
  }
  return best;
}

function scoreMatch(detected: DetectedCard, card: PokemonCard): number {
  let score = 0;
  const nameMatch = card.name.toLowerCase() === detected.name.toLowerCase();
  if (nameMatch) score += 50;
  else if (card.name.toLowerCase().includes(detected.name.toLowerCase())) score += 30;

  if (detected.setName && card.set.name.toLowerCase().includes(detected.setName.toLowerCase())) {
    score += 25;
  }

  if (detected.cardNumber) {
    const normalizedDetected = detected.cardNumber.replace(/^0+/, "");
    const normalizedCard = card.number.replace(/^0+/, "");
    if (normalizedDetected === normalizedCard) score += 25;
  }

  return score;
}

function mapCard(card: PokemonCard) {
  return {
    id: card.id,
    name: card.name,
    set: card.set.name,
    number: card.number,
    rarity: card.rarity,
    imageUrl: card.images?.large ?? card.images?.small,
    tcgplayerUrl: card.tcgplayer?.url,
    prices: toPrices(card.tcgplayer?.prices),
  };
}

export async function lookupCard(
  detected: DetectedCard,
  apiKey?: string,
): Promise<MatchedCard> {
  const searchQuery = buildSearchQuery(detected);

  try {
    const url = new URL(`${API_BASE}/cards`);
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("pageSize", "5");
    url.searchParams.set("orderBy", "-set.releaseDate");

    const response = await fetch(url, {
      headers: buildHeaders(apiKey),
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return {
        detected,
        matchStatus: "not_found",
        searchQuery,
        error: `Pokemon TCG API fout (${response.status})`,
      };
    }

    const payload = (await response.json()) as SearchResponse;
    if (!payload.data?.length) {
      const fallbackUrl = new URL(`${API_BASE}/cards`);
      fallbackUrl.searchParams.set("q", `name:"${escapeQuery(detected.name)}"`);
      fallbackUrl.searchParams.set("pageSize", "5");

      const fallbackResponse = await fetch(fallbackUrl, {
        headers: buildHeaders(apiKey),
        next: { revalidate: 3600 },
      });

      if (!fallbackResponse.ok) {
        return {
          detected,
          matchStatus: "not_found",
          searchQuery,
          error: "Geen match gevonden",
        };
      }

      const fallbackPayload = (await fallbackResponse.json()) as SearchResponse;
      if (!fallbackPayload.data?.length) {
        return { detected, matchStatus: "not_found", searchQuery };
      }

      const bestFallback = [...fallbackPayload.data].sort(
        (a, b) => scoreMatch(detected, b) - scoreMatch(detected, a),
      )[0];

      return {
        detected,
        matchStatus: "partial",
        searchQuery,
        card: mapCard(bestFallback),
      };
    }

    const best = [...payload.data].sort(
      (a, b) => scoreMatch(detected, b) - scoreMatch(detected, a),
    )[0];
    const bestScore = scoreMatch(detected, best);

    return {
      detected,
      matchStatus: bestScore >= 75 ? "matched" : bestScore >= 40 ? "partial" : "not_found",
      searchQuery,
      card: mapCard(best),
    };
  } catch (error) {
    return {
      detected,
      matchStatus: "not_found",
      searchQuery,
      error: error instanceof Error ? error.message : "Onbekende fout bij lookup",
    };
  }
}

export async function lookupCards(
  detected: DetectedCard[],
  apiKey?: string,
): Promise<MatchedCard[]> {
  const results: MatchedCard[] = [];

  for (const card of detected) {
    results.push(await lookupCard(card, apiKey));
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return results;
}
