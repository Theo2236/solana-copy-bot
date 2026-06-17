import { SOL_MINT } from "./config";
import {
  buyTokenWithSol,
  sellTokenForSol,
  type JupiterQuote,
} from "./jupiter";
import { isPumpMint } from "./pump-quote";
import { buyPumpTokenWithSol, sellPumpTokenForSol } from "./pump-swap";
import {
  formatQuoteError,
  getTradeQuote,
  type QuoteSource,
} from "./trade-quote";

export type TradeExecutionSource = QuoteSource;

export type TradeExecutionResult = {
  signature: string;
  quote: JupiterQuote;
  source: TradeExecutionSource;
};

/**
 * Voert een live buy uit: Jupiter als primaire route, pump.fun bonding curve
 * als fallback voor verse pump-mints zonder Jupiter-route.
 */
export async function executeBuyTokenWithSol(params: {
  mint: string;
  solAmount: number;
  slippageBps: number;
}): Promise<TradeExecutionResult> {
  const lamports = Math.floor(params.solAmount * 1_000_000_000);
  const quoteResult = await getTradeQuote({
    inputMint: SOL_MINT,
    outputMint: params.mint,
    amountLamports: lamports,
    slippageBps: params.slippageBps,
  });

  if (!quoteResult.quote) {
    throw new Error(`Geen quote: ${formatQuoteError(quoteResult)}`);
  }

  if (quoteResult.source === "pump_bonding_curve") {
    const result = await buyPumpTokenWithSol(params);
    return { ...result, source: "pump_bonding_curve" };
  }

  try {
    const result = await buyTokenWithSol(params);
    return { ...result, source: "jupiter" };
  } catch (jupiterError) {
    if (!isPumpMint(params.mint)) {
      throw jupiterError;
    }
    const message =
      jupiterError instanceof Error ? jupiterError.message : "Jupiter buy mislukt";
    try {
      const result = await buyPumpTokenWithSol(params);
      return { ...result, source: "pump_bonding_curve" };
    } catch (pumpError) {
      const pumpMessage =
        pumpError instanceof Error ? pumpError.message : "Pump buy mislukt";
      throw new Error(`Jupiter: ${message}. Pump: ${pumpMessage}`);
    }
  }
}

/**
 * Voert een live sell uit: Jupiter eerst, pump.fun bonding curve als fallback.
 */
export async function executeSellTokenForSol(params: {
  mint: string;
  tokenAmount: string;
  slippageBps: number;
}): Promise<TradeExecutionResult> {
  const quoteResult = await getTradeQuote({
    inputMint: params.mint,
    outputMint: SOL_MINT,
    amountLamports: BigInt(params.tokenAmount),
    slippageBps: params.slippageBps,
  });

  if (quoteResult.source === "pump_bonding_curve" && quoteResult.quote) {
    const result = await sellPumpTokenForSol(params);
    return { ...result, source: "pump_bonding_curve" };
  }

  try {
    const result = await sellTokenForSol(params);
    return { ...result, source: "jupiter" };
  } catch (jupiterError) {
    if (!isPumpMint(params.mint)) {
      throw jupiterError;
    }
    const message =
      jupiterError instanceof Error ? jupiterError.message : "Jupiter sell mislukt";
    try {
      const result = await sellPumpTokenForSol(params);
      return { ...result, source: "pump_bonding_curve" };
    } catch (pumpError) {
      const pumpMessage =
        pumpError instanceof Error ? pumpError.message : "Pump sell mislukt";
      throw new Error(`Jupiter: ${message}. Pump: ${pumpMessage}`);
    }
  }
}
