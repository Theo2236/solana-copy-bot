import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getBotConfig, isDryRun, SOL_MINT } from "./config";
import { computeCopyTradeSize, formatConvictionPct } from "./copy-sizing";
import { buyTokenWithSol, getQuote, sellTokenForSol } from "./jupiter";
import {
  addEvent,
  createEventId,
  getBotEnabledState,
  getPositions,
  getStats,
  getTargets,
  getTradesToday,
  incrementTradesToday,
  markSignatureProcessed,
  recordTradeResult,
  upsertPosition,
} from "./store";
import type { ParsedSwap, Position } from "./types";
import { getBotBalanceSol } from "./solana";
import { getSolPriceEur } from "./price";
import { getTokenMarketData } from "./token-data";

/** Maximale price impact (%) op een buy-quote voordat we de trade als te illiquide skippen. */
const MAX_BUY_PRICE_IMPACT_PCT = 10;

export async function processSwap(swap: ParsedSwap): Promise<void> {
  // Dedup: cron én webhook kunnen dezelfde swap aanleveren. Sleutel op
  // signature + side + mint zodat we re-deliveries droppen maar losse swaps
  // binnen één tx behouden.
  const dedupKey = `${swap.signature}:${swap.side}:${swap.mint}`;
  const fresh = await markSignatureProcessed(dedupKey);
  if (!fresh) {
    return;
  }

  const config = getBotConfig();
  const enabled = await getBotEnabledState();
  const targets = await getTargets();
  const target = targets.find(
    (t) => t.address === swap.wallet && t.enabled,
  );

  if (!target) {
    await logSkip(swap, "Wallet niet in actieve targets");
    return;
  }

  if (!enabled) {
    await logSkip(swap, "Bot staat uit");
    return;
  }

  if (swap.side === "buy") {
    await handleCopyBuy(swap, config);
    return;
  }

  await handleCopySell(swap);
}

async function handleCopyBuy(
  swap: ParsedSwap,
  config: ReturnType<typeof getBotConfig>,
): Promise<void> {
  const positions = await getPositions();
  const openPositions = positions.filter((p) => p.status === "open");
  const tradesToday = await getTradesToday();

  if (openPositions.length >= config.maxOpenPositions) {
    await logSkip(swap, "Max open posities bereikt");
    return;
  }

  if (tradesToday >= config.maxTradesPerDay) {
    await logSkip(swap, "Daglimiet trades bereikt");
    return;
  }

  if (openPositions.some((p) => p.mint === swap.mint)) {
    await logSkip(swap, "Positie voor mint bestaat al");
    return;
  }

  // Max drawdown: bij een gerealiseerd verlies (in EUR) boven de limiet stoppen
  // we met nieuwe buys. Bestaande posities blijven open en worden via stop
  // loss / take profit afgehandeld.
  if (config.maxDrawdownEur > 0) {
    const stats = await getStats();
    if (stats.realizedPnlSol < 0) {
      const solEur = await getSolPriceEur();
      if (solEur !== null) {
        const realizedEur = stats.realizedPnlSol * solEur;
        if (-realizedEur >= config.maxDrawdownEur) {
          await logSkip(
            swap,
            `Max drawdown bereikt (€${(-realizedEur).toFixed(2)} ≥ €${config.maxDrawdownEur})`,
          );
          return;
        }
      }
    }
  }

  // Liquiditeit + tokenleeftijd controleren via Dexscreener. Bij ontbrekende
  // data (API down / geen pairs) gaan we fail-open verder; de price-impact-guard
  // op de quote vangt extreem illiquide tokens alsnog af.
  const market = await getTokenMarketData(swap.mint);
  if (market !== null) {
    if (market.liquidityUsd < config.minLiquidityUsd) {
      await logSkip(
        swap,
        `Liquiditeit te laag ($${Math.round(market.liquidityUsd).toLocaleString("nl-NL")} < $${config.minLiquidityUsd.toLocaleString("nl-NL")})`,
      );
      return;
    }
    if (
      config.minTokenAgeHours > 0 &&
      market.ageHours !== null &&
      market.ageHours < config.minTokenAgeHours
    ) {
      await logSkip(
        swap,
        `Token te jong (${market.ageHours.toFixed(1)}u < ${config.minTokenAgeHours}u)`,
      );
      return;
    }
  }

  const sizing = await computeCopyTradeSize(swap, config);
  const tradeSol = sizing.tradeSol;

  if (!isDryRun()) {
    const balance = await getBotBalanceSol();
    if (balance < tradeSol + 0.01) {
      await logSkip(swap, "Onvoldoende SOL saldo");
      return;
    }
  }

  const position: Position = {
    id: createEventId(),
    mint: swap.mint,
    entrySol: tradeSol,
    openedAt: new Date().toISOString(),
    sourceWallet: swap.wallet,
    sourceTx: swap.signature,
    status: "open",
  };

  const sizingMeta =
    sizing.mode === "conviction" && sizing.convictionPct !== null
      ? {
          copySizeMode: sizing.mode,
          targetBuySol: swap.solAmount,
          targetWalletSolEst: sizing.targetWalletSol,
          targetConvictionPct: sizing.convictionPct,
          copyMultiplier: sizing.multiplier,
        }
      : { copySizeMode: sizing.mode };

  const convictionNote =
    sizing.convictionPct !== null
      ? ` (target ${formatConvictionPct(sizing.convictionPct)} wallet)`
      : "";

  if (isDryRun()) {
    // Echte quote ophalen zodat de gesimuleerde positie een realistische
    // token-hoeveelheid krijgt; daarmee wordt de dry-run PnL marktgebaseerd.
    const quote = await getQuote({
      inputMint: SOL_MINT,
      outputMint: swap.mint,
      amountLamports: Math.floor(tradeSol * LAMPORTS_PER_SOL),
      slippageBps: config.slippageBps,
    });

    if (quote) {
      const impact = Number(quote.priceImpactPct) * 100;
      if (Number.isFinite(impact) && impact > MAX_BUY_PRICE_IMPACT_PCT) {
        await logSkip(
          swap,
          `Price impact te hoog (${impact.toFixed(1)}% > ${MAX_BUY_PRICE_IMPACT_PCT}%) — te illiquide`,
        );
        return;
      }
      position.quantity = quote.outAmount;
      const qty = Number(quote.outAmount);
      if (qty > 0) {
        position.entryPrice = tradeSol / qty;
      }
    }

    await upsertPosition(position);
    await incrementTradesToday();
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "copy_buy",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `[DRY RUN] Zou ${tradeSol} SOL kopen op ${swap.mint}${convictionNote}`,
      txSignature: swap.signature,
      metadata: {
        mode: "dry_run",
        quantity: position.quantity ?? null,
        tradeSol,
        ...sizingMeta,
      },
    });
    return;
  }

  try {
    const preQuote = await getQuote({
      inputMint: SOL_MINT,
      outputMint: swap.mint,
      amountLamports: Math.floor(tradeSol * LAMPORTS_PER_SOL),
      slippageBps: config.slippageBps,
    });
    if (preQuote) {
      const impact = Number(preQuote.priceImpactPct) * 100;
      if (Number.isFinite(impact) && impact > MAX_BUY_PRICE_IMPACT_PCT) {
        await logSkip(
          swap,
          `Price impact te hoog (${impact.toFixed(1)}% > ${MAX_BUY_PRICE_IMPACT_PCT}%) — te illiquide`,
        );
        return;
      }
    }

    const result = await buyTokenWithSol({
      mint: swap.mint,
      solAmount: tradeSol,
      slippageBps: config.slippageBps,
    });

    position.quantity = result.quote.outAmount;
    await upsertPosition(position);
    await incrementTradesToday();
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "copy_buy",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `Gekocht: ${tradeSol} SOL → ${swap.mint}${convictionNote}`,
      txSignature: result.signature,
      metadata: { tradeSol, ...sizingMeta },
    });
  } catch (error) {
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "error",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `Buy mislukt: ${error instanceof Error ? error.message : "onbekend"}`,
      txSignature: swap.signature,
    });
  }
}

async function handleCopySell(swap: ParsedSwap): Promise<void> {
  const positions = await getPositions();
  const position = positions.find(
    (p) => p.mint === swap.mint && p.status === "open",
  );

  if (!position) {
    await logSkip(swap, "Geen open positie om te verkopen");
    return;
  }

  if (isDryRun()) {
    const exitSol = await quoteSellSol(position);
    const pnlSol =
      exitSol !== null ? exitSol - position.entrySol : estimatePnl(position);
    const marketBased = exitSol !== null;
    position.status = "closed";
    position.closedAt = new Date().toISOString();
    position.closeReason = "copy_sell";
    position.exitSol = position.entrySol + pnlSol;
    position.pnlSol = pnlSol;
    await upsertPosition(position);
    await recordTradeResult(pnlSol);
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "copy_sell",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `[DRY RUN] Positie gesloten op copy-sell (PnL ${pnlSol.toFixed(4)} SOL${marketBased ? "" : ", schatting"})`,
      txSignature: swap.signature,
      metadata: { mode: "dry_run", marketBased },
    });
    return;
  }

  if (!position.quantity) {
    await logSkip(swap, "Geen token quantity opgeslagen voor sell");
    return;
  }

  try {
    const result = await sellTokenForSol({
      mint: swap.mint,
      tokenAmount: position.quantity,
      slippageBps: getBotConfig().slippageBps,
    });

    const exitSol =
      Number(result.quote.outAmount) / LAMPORTS_PER_SOL;
    const pnlSol = exitSol - position.entrySol;

    position.status = "closed";
    position.closedAt = new Date().toISOString();
    position.closeReason = "copy_sell";
    position.exitSol = exitSol;
    position.pnlSol = pnlSol;
    await upsertPosition(position);
    await recordTradeResult(pnlSol);

    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "copy_sell",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `Verkocht: ${swap.mint} (PnL ${pnlSol.toFixed(4)} SOL)`,
      txSignature: result.signature,
    });
  } catch (error) {
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "error",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `Sell mislukt: ${error instanceof Error ? error.message : "onbekend"}`,
      txSignature: swap.signature,
    });
  }
}

function estimatePnl(position: Position): number {
  return position.entrySol * 0.05 * (Math.random() > 0.5 ? 1 : -1);
}

/**
 * Haalt de actuele SOL-waarde van een positie op via een Jupiter sell-quote.
 * Geeft `null` terug als er geen quantity of quote beschikbaar is.
 */
async function quoteSellSol(position: Position): Promise<number | null> {
  if (!position.quantity) return null;
  const tokenAmount = Number(position.quantity);
  if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) return null;

  const quote = await getQuote({
    inputMint: position.mint,
    outputMint: SOL_MINT,
    amountLamports: Math.floor(tokenAmount),
    slippageBps: getBotConfig().slippageBps,
  });
  if (!quote) return null;

  const outSol = Number(quote.outAmount) / LAMPORTS_PER_SOL;
  return Number.isFinite(outSol) ? outSol : null;
}

async function logSkip(swap: ParsedSwap, reason: string): Promise<void> {
  await addEvent({
    id: createEventId(),
    timestamp: new Date().toISOString(),
    type: "skip",
    wallet: swap.wallet,
    mint: swap.mint,
    message: reason,
    txSignature: swap.signature,
  });
}

export async function checkOpenPositions(): Promise<void> {
  const config = getBotConfig();
  const positions = await getPositions();

  for (const position of positions.filter((p) => p.status === "open")) {
    const exitSol = await quoteSellSol(position);

    if (exitSol !== null && position.entrySol > 0) {
      const pnlPct = ((exitSol - position.entrySol) / position.entrySol) * 100;

      if (pnlPct <= -config.stopLossPct) {
        await closePosition(position, "stop_loss", exitSol, pnlPct);
        continue;
      }
      if (pnlPct >= config.takeProfitPct) {
        await closePosition(position, "take_profit", exitSol, pnlPct);
        continue;
      }
    }

    const ageHours =
      (Date.now() - new Date(position.openedAt).getTime()) / 3_600_000;

    if (ageHours > 24) {
      await addEvent({
        id: createEventId(),
        timestamp: new Date().toISOString(),
        type: "position_close",
        mint: position.mint,
        message: `Positie ouder dan 24u — handmatige review aanbevolen (SL ${config.stopLossPct}% / TP ${config.takeProfitPct}%)`,
      });
    }
  }
}

/**
 * Sluit een positie op basis van SL/TP. In dry-run wordt de quote-waarde
 * gebruikt; live wordt er daadwerkelijk verkocht via Jupiter.
 */
async function closePosition(
  position: Position,
  reason: "stop_loss" | "take_profit",
  exitSolQuote: number,
  pnlPct: number,
): Promise<void> {
  const label = reason === "stop_loss" ? "Stop-loss" : "Take-profit";

  if (isDryRun()) {
    const pnlSol = exitSolQuote - position.entrySol;
    position.status = "closed";
    position.closedAt = new Date().toISOString();
    position.closeReason = reason;
    position.exitSol = exitSolQuote;
    position.pnlSol = pnlSol;
    await upsertPosition(position);
    await recordTradeResult(pnlSol);
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "position_close",
      mint: position.mint,
      message: `[DRY RUN] ${label} (${pnlPct.toFixed(1)}%) — positie gesloten (PnL ${pnlSol.toFixed(4)} SOL)`,
      metadata: { mode: "dry_run", reason },
    });
    return;
  }

  if (!position.quantity) return;

  try {
    const result = await sellTokenForSol({
      mint: position.mint,
      tokenAmount: position.quantity,
      slippageBps: getBotConfig().slippageBps,
    });
    const exitSol = Number(result.quote.outAmount) / LAMPORTS_PER_SOL;
    const pnlSol = exitSol - position.entrySol;
    position.status = "closed";
    position.closedAt = new Date().toISOString();
    position.closeReason = reason;
    position.exitSol = exitSol;
    position.pnlSol = pnlSol;
    await upsertPosition(position);
    await recordTradeResult(pnlSol);
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "position_close",
      mint: position.mint,
      message: `${label} (${pnlPct.toFixed(1)}%) — verkocht (PnL ${pnlSol.toFixed(4)} SOL)`,
      txSignature: result.signature,
    });
  } catch (error) {
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "error",
      mint: position.mint,
      message: `${label} sluiten mislukt: ${error instanceof Error ? error.message : "onbekend"}`,
    });
  }
}
