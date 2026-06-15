/**
 * Marktdata per token via de publieke Dexscreener API (geen API-key nodig).
 * Levert liquiditeit in USD en de leeftijd van het oudste pair, zodat de engine
 * `minLiquidityUsd` en `minTokenAgeHours` automatisch kan afdwingen.
 */

export type TokenMarketData = {
  /** Som van de liquiditeit (USD) over alle pairs van dit token. */
  liquidityUsd: number;
  /** Leeftijd in uren op basis van het oudste pair, of null als onbekend. */
  ageHours: number | null;
};

type DexscreenerPair = {
  liquidity?: { usd?: number };
  pairCreatedAt?: number;
};

const DEXSCREENER_URL = "https://api.dexscreener.com/latest/dex/tokens";
const FETCH_TIMEOUT_MS = 5_000;

/**
 * Haalt liquiditeit en tokenleeftijd op. Geeft `null` terug wanneer de data niet
 * beschikbaar is (API down, geen pairs); de engine behandelt dat als fail-open
 * zodat een tijdelijke storing de bot niet volledig blokkeert.
 */
export async function getTokenMarketData(
  mint: string,
): Promise<TokenMarketData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(`${DEXSCREENER_URL}/${mint}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) return null;

    const json = (await response.json()) as { pairs?: DexscreenerPair[] };
    const pairs = json.pairs ?? [];
    if (pairs.length === 0) return null;

    const liquidityUsd = pairs.reduce(
      (sum, pair) => sum + (pair.liquidity?.usd ?? 0),
      0,
    );

    const createdTimestamps = pairs
      .map((pair) => pair.pairCreatedAt)
      .filter((ts): ts is number => typeof ts === "number" && ts > 0);

    const oldest = createdTimestamps.length
      ? Math.min(...createdTimestamps)
      : null;
    const ageHours =
      oldest !== null ? (Date.now() - oldest) / (1000 * 60 * 60) : null;

    return { liquidityUsd, ageHours };
  } catch {
    return null;
  }
}
