import { getJupiterQuote, type JupiterQuote, type QuoteFailureReason } from "./jupiter";
import { getPumpBondingCurveQuote, isPumpMint } from "./pump-quote";

export type { QuoteFailureReason };

export type QuoteSource = "jupiter" | "pump_bonding_curve";

export type TradeQuoteResult = {
  quote: JupiterQuote | null;
  source?: QuoteSource;
  error?: {
    reason: QuoteFailureReason;
    message: string;
    statusCode?: number;
    errorCode?: string;
  };
};

function formatQuoteError(result: TradeQuoteResult): string {
  if (!result.error) return "Geen quote beschikbaar";
  const code = result.error.errorCode ? ` [${result.error.errorCode}]` : "";
  return `${result.error.message}${code}`;
}

export { formatQuoteError };

/**
 * Haalt een echte swap-quote op: eerst Jupiter, daarna pump.fun bonding curve
 * als fallback voor verse pump-mints die Jupiter (nog) niet routeert.
 */
export async function getTradeQuote(params: {
  inputMint: string;
  outputMint: string;
  amountLamports: number;
  slippageBps: number;
}): Promise<TradeQuoteResult> {
  if (params.amountLamports < 1) {
    return {
      quote: null,
      error: {
        reason: "amount_too_small",
        message: `Swapbedrag te klein (${params.amountLamports} lamports)`,
      },
    };
  }

  const jupiter = await getJupiterQuote(params);
  if (jupiter.quote) {
    return { quote: jupiter.quote, source: "jupiter" };
  }

  const tokenMint =
    params.inputMint === "So11111111111111111111111111111111111111112"
      ? params.outputMint
      : params.inputMint;

  const shouldTryPump =
    isPumpMint(tokenMint) &&
    (jupiter.error?.errorCode === "TOKEN_NOT_TRADABLE" ||
      jupiter.error?.reason === "no_route");

  if (!shouldTryPump) {
    return jupiter;
  }

  const pump = await getPumpBondingCurveQuote({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amountLamports: params.amountLamports,
  });

  if (pump.quote) {
    return { quote: pump.quote, source: "pump_bonding_curve" };
  }

  const pumpMessage = pump.error ?? "Pump bonding-curve quote mislukt";
  const graduated = pumpMessage.includes("afgestudeerd");

  return {
    quote: null,
    error: {
      reason: graduated ? "pump_graduated" : "pump_no_data",
      message: `Jupiter: ${jupiter.error?.message ?? "geen route"}. Pump: ${pumpMessage}`,
      errorCode: jupiter.error?.errorCode,
      statusCode: jupiter.error?.statusCode,
    },
  };
}
