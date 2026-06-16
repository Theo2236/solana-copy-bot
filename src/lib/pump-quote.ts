import { SOL_MINT } from "./config";
import type { JupiterQuote } from "./jupiter";

const PUMP_COIN_URL = "https://frontend-api-v3.pump.fun/coins";
const FETCH_TIMEOUT_MS = 8_000;
/** Pump.fun protocol fee op bonding-curve trades (1%). */
const PUMP_FEE_BPS = 100n;

export type PumpCoinData = {
  mint: string;
  complete: boolean;
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
  realTokenReserves: bigint;
};

async function fetchPumpCoin(mint: string): Promise<PumpCoinData | null> {
  try {
    const response = await fetch(`${PUMP_COIN_URL}/${mint}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!response.ok) return null;

    const json = (await response.json()) as {
      mint?: string;
      complete?: boolean;
      virtual_sol_reserves?: number;
      virtual_quote_reserves?: number;
      virtual_token_reserves?: number;
      real_token_reserves?: number;
    };

    const virtualSol = BigInt(
      json.virtual_quote_reserves ?? json.virtual_sol_reserves ?? 0,
    );
    const virtualToken = BigInt(json.virtual_token_reserves ?? 0);
    if (virtualSol <= 0n || virtualToken <= 0n) return null;

    return {
      mint: json.mint ?? mint,
      complete: Boolean(json.complete),
      virtualSolReserves: virtualSol,
      virtualTokenReserves: virtualToken,
      realTokenReserves: BigInt(json.real_token_reserves ?? 0),
    };
  } catch {
    return null;
  }
}

/** Pump.fun-mints eindigen vrijwel altijd op "pump". */
export function isPumpMint(mint: string): boolean {
  return mint.toLowerCase().endsWith("pump");
}

/**
 * Berekent tokens ontvangen voor een SOL-buy op de pump.fun bonding curve
 * (constant-product, zelfde formule als on-chain buy_exact_sol_in).
 */
function calculatePumpBuyOutAmount(
  coin: PumpCoinData,
  solLamports: bigint,
): bigint | null {
  if (solLamports <= 0n || coin.complete) return null;

  const netSol = (solLamports * 10_000n) / (10_000n + PUMP_FEE_BPS);
  const tokensOut =
    (netSol * coin.virtualTokenReserves) /
    (coin.virtualSolReserves + netSol);

  if (tokensOut <= 0n) return null;

  if (coin.realTokenReserves > 0n && tokensOut > coin.realTokenReserves) {
    return coin.realTokenReserves;
  }

  return tokensOut;
}

/**
 * Berekent SOL ontvangen voor een token-sell op de pump.fun bonding curve.
 */
function calculatePumpSellOutAmount(
  coin: PumpCoinData,
  tokenAmount: bigint,
): bigint | null {
  if (tokenAmount <= 0n || coin.complete) return null;

  const grossSol =
    (tokenAmount * coin.virtualSolReserves) /
    (coin.virtualTokenReserves + tokenAmount);
  if (grossSol <= 0n) return null;

  const netSol = (grossSol * (10_000n - PUMP_FEE_BPS)) / 10_000n;
  return netSol > 0n ? netSol : null;
}

export type PumpQuoteResult = {
  quote: JupiterQuote | null;
  error?: string;
};

export async function getPumpBondingCurveQuote(params: {
  inputMint: string;
  outputMint: string;
  amountLamports: number;
}): Promise<PumpQuoteResult> {
  const isBuy = params.inputMint === SOL_MINT;
  const isSell = params.outputMint === SOL_MINT;
  if (!isBuy && !isSell) {
    return { quote: null, error: "Pump-fallback alleen voor SOL↔token swaps" };
  }

  const tokenMint = isBuy ? params.outputMint : params.inputMint;
  if (!isPumpMint(tokenMint)) {
    return { quote: null, error: "Geen pump.fun-mint" };
  }

  const coin = await fetchPumpCoin(tokenMint);
  if (!coin) {
    return {
      quote: null,
      error: "Pump.fun coin-data niet beschikbaar",
    };
  }

  if (coin.complete) {
    return {
      quote: null,
      error: "Token is afgestudeerd van bonding curve — alleen Jupiter",
    };
  }

  const amount = BigInt(params.amountLamports);
  const outAmount = isBuy
    ? calculatePumpBuyOutAmount(coin, amount)
    : calculatePumpSellOutAmount(coin, amount);

  if (!outAmount || outAmount <= 0n) {
    return {
      quote: null,
      error: "Bonding-curve berekening gaf geen geldige output",
    };
  }

  return {
    quote: {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inAmount: String(params.amountLamports),
      outAmount: outAmount.toString(),
      priceImpactPct: "0",
    },
  };
}
