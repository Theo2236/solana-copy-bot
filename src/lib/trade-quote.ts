import { SOL_MINT } from "./config";
import { getJupiterQuote, toQuoteAmountLamports, type JupiterQuote, type QuoteFailureReason } from "./jupiter";
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

function tokenMintFromSwap(inputMint: string, outputMint: string): string {
  return inputMint === SOL_MINT ? outputMint : inputMint;
}

/**
 * Haalt een swap-quote op. Voor pump.fun-mints op de bonding curve gebruiken we
 * de curve-berekening eerst (nauwkeuriger, geen misleidende Jupiter-impact).
 * Daarna Jupiter als fallback (graduated tokens, andere routes).
 */
export async function getTradeQuote(params: {
  inputMint: string;
  outputMint: string;
  amountLamports: number | bigint;
  slippageBps: number;
}): Promise<TradeQuoteResult> {
  if (
    (typeof params.amountLamports === "number" && params.amountLamports < 1) ||
    (typeof params.amountLamports === "bigint" && params.amountLamports < 1n)
  ) {
    return {
      quote: null,
      error: {
        reason: "amount_too_small",
        message: `Swapbedrag te klein (${params.amountLamports} lamports)`,
      },
    };
  }

  const lamports = toQuoteAmountLamports(params.amountLamports);
  if (lamports === null) {
    return {
      quote: null,
      error: {
        reason: "amount_too_small",
        message: `Ongeldig swapbedrag (${params.amountLamports} lamports)`,
      },
    };
  }

  const tokenMint = tokenMintFromSwap(params.inputMint, params.outputMint);

  let pumpError: string | undefined;
  if (isPumpMint(tokenMint)) {
    const pump = await getPumpBondingCurveQuote({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amountLamports: lamports,
    });
    if (pump.quote) {
      return { quote: pump.quote, source: "pump_bonding_curve" };
    }
    pumpError = pump.error ?? "Pump bonding-curve quote mislukt";
  }

  const jupiter = await getJupiterQuote({ ...params, amountLamports: lamports });
  if (jupiter.quote) {
    return { quote: jupiter.quote, source: "jupiter" };
  }

  if (!isPumpMint(tokenMint)) {
    return jupiter;
  }

  const graduated = (pumpError ?? "").includes("afgestudeerd");

  return {
    quote: null,
    error: {
      reason: graduated ? "pump_graduated" : "pump_no_data",
      message: `Jupiter: ${jupiter.error?.message ?? "geen route"}. Pump: ${pumpError ?? "onbekend"}`,
      errorCode: jupiter.error?.errorCode,
      statusCode: jupiter.error?.statusCode,
    },
  };
}
