import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getBotConfig, isCopyableMint, isDryRun, SOL_MINT } from "./config";
import { computeCopyTradeSize, formatConvictionPct } from "./copy-sizing";
import { executeBuyTokenWithSol, executeSellTokenForSol } from "./trade-execute";
import { formatQuoteError, getTradeQuote } from "./trade-quote";
import type { QuoteSource } from "./trade-quote";
import {
  addEvent,
  addTargetHolding,
  createEventId,
  getBotEnabledState,
  getPositions,
  getTargetHolding,
  getTargets,
  incrementTradesToday,
  markSignatureProcessed,
  recordTradeResult,
  reduceTargetHolding,
  upsertPosition,
} from "./store";
import type { ParsedSwap, Position } from "./types";
import { getBotBalanceSol } from "./solana";
import { getTokenMarketData } from "./token-data";
import {
  markHomerunTierDone,
  planHomerunExit,
  updatePeakPnl,
} from "./homerun-exits";

function jupiterPriceImpactPct(quote: { priceImpactPct: string }): number {
  return Number(quote.priceImpactPct) * 100;
}

function shouldSkipForPriceImpact(
  quoteResult: { source?: QuoteSource; quote: { priceImpactPct: string } | null },
  maxPct: number,
): boolean {
  if (maxPct <= 0) return false;
  if (quoteResult.source === "pump_bonding_curve") return false;
  if (!quoteResult.quote) return false;
  const impact = jupiterPriceImpactPct(quoteResult.quote);
  return Number.isFinite(impact) && impact > maxPct;
}

function priceImpactSkipMessage(impact: number, maxPct: number): string {
  return `Price impact te hoog (${impact.toFixed(1)}% > ${maxPct}%) — te illiquide`;
}

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

  // Geen memecoin (SOL→USDC/USDT of liquid-staking) — nooit kopen. Een sell
  // van zo'n mint laten we wel door zodat een eventuele oude positie kan sluiten.
  if (swap.side === "buy" && !isCopyableMint(swap.mint)) {
    await logSkip(swap, "Geen memecoin (stablecoin/SOL) — overgeslagen");
    return;
  }

  if (swap.side === "buy") {
    // Houd bij hoeveel van deze munt de target nu aanhoudt (voor sell-fractie).
    if (swap.tokenAmount && swap.tokenAmount > 0) {
      await addTargetHolding(swap.wallet, swap.mint, swap.tokenAmount);
    }
    await handleCopyBuy(swap, config);
    return;
  }

  const fraction = await computeSellFraction(swap);
  await handleCopySell(swap, fraction);
}

/**
 * Bepaalt welk deel van onze positie we verkopen op basis van hoeveel de target
 * van zijn aangehouden hoeveelheid verkocht. Onbekend → 1 (volledige sell).
 */
async function computeSellFraction(swap: ParsedSwap): Promise<number> {
  const amount = swap.tokenAmount;
  if (!amount || amount <= 0) return 1;

  const held = await getTargetHolding(swap.wallet, swap.mint);
  await reduceTargetHolding(swap.wallet, swap.mint, amount);

  if (held <= 0) return 1;
  const fraction = amount / held;
  if (!Number.isFinite(fraction) || fraction <= 0) return 1;
  return Math.min(1, fraction);
}

/** Parse een raw integer-quantity string veilig naar BigInt. */
function safeBigInt(value: string | undefined): bigint {
  if (!value) return 0n;
  try {
    return BigInt(value.split(".")[0]);
  } catch {
    return 0n;
  }
}

/**
 * Voegt een buy samen met een eventuele bestaande open positie (averaging-in):
 * sommeert quantity + entrySol en herberekent de gewogen gemiddelde entryprijs.
 */
function mergeBuy(
  existing: Position | undefined,
  swap: ParsedSwap,
  tradeSol: number,
  quantityRaw: string | undefined,
): Position {
  const now = new Date().toISOString();
  const addQty = safeBigInt(quantityRaw);

  if (existing) {
    const totalQty = safeBigInt(existing.quantity) + addQty;
    const newEntrySol = existing.entrySol + tradeSol;
    const qtyStr =
      existing.quantity || quantityRaw ? totalQty.toString() : undefined;
    const qtyNum = Number(totalQty);
    return {
      ...existing,
      entrySol: newEntrySol,
      quantity: qtyStr,
      entryPrice: qtyNum > 0 ? newEntrySol / qtyNum : existing.entryPrice,
      buyCount: (existing.buyCount ?? 1) + 1,
      lastBuyAt: now,
    };
  }

  const qtyNum = Number(addQty);
  return {
    id: createEventId(),
    mint: swap.mint,
    entrySol: tradeSol,
    entryPrice: qtyNum > 0 ? tradeSol / qtyNum : undefined,
    quantity: quantityRaw,
    openedAt: now,
    sourceWallet: swap.wallet,
    sourceTx: swap.signature,
    status: "open",
    buyCount: 1,
  };
}

async function handleCopyBuy(
  swap: ParsedSwap,
  config: ReturnType<typeof getBotConfig>,
): Promise<void> {
  const positions = await getPositions();
  const openPositions = positions.filter((p) => p.status === "open");
  const existing = openPositions.find((p) => p.mint === swap.mint);

  // Alleen een nieuwe mint telt mee voor max open posities; bijkopen op een
  // bestaande positie (averaging-in) mag altijd.
  if (!existing && openPositions.length >= config.maxOpenPositions) {
    await logSkip(swap, "Max open posities bereikt");
    return;
  }

  // Liquiditeit + tokenleeftijd controleren via Dexscreener. Bij ontbrekende
  // data (API down / geen pairs) gaan we fail-open verder; de price-impact-guard
  // op de quote vangt extreem illiquide tokens alsnog af.
  const market = await getTokenMarketData(swap.mint);
  if (market !== null) {
    // Verse pump.fun-tokens rapporteren vaak $0 omdat Dexscreener ze nog niet
    // (volledig) heeft geïndexeerd. Dat behandelen we als 'onbekend' en laten we
    // door — de price-impact-guard op de quote houdt écht illiquide tokens tegen.
    // Alleen bij een bekende, te lage liquiditeit (> $0) skippen we.
    if (market.liquidityUsd > 0 && market.liquidityUsd < config.minLiquidityUsd) {
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

  if (!Number.isFinite(tradeSol) || tradeSol <= 0) {
    await logSkip(swap, "Ongeldige tradegrootte (config/sizing)");
    return;
  }

  if (
    config.minTargetConvictionPct > 0 &&
    sizing.convictionPct !== null &&
    sizing.convictionPct < config.minTargetConvictionPct
  ) {
    await logSkip(
      swap,
      `Target-inzet te laag (${formatConvictionPct(sizing.convictionPct)} < ${formatConvictionPct(config.minTargetConvictionPct)})`,
    );
    return;
  }

  if (!isDryRun()) {
    const balance = await getBotBalanceSol();
    if (balance < tradeSol + 0.01) {
      await logSkip(swap, "Onvoldoende SOL saldo");
      return;
    }
  }

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

  const averagedIn = Boolean(existing);

  if (isDryRun()) {
    const quoteResult = await getTradeQuote({
      inputMint: SOL_MINT,
      outputMint: swap.mint,
      amountLamports: Math.floor(tradeSol * LAMPORTS_PER_SOL),
      slippageBps: config.slippageBps,
    });

    if (!quoteResult.quote) {
      await logSkip(swap, `Geen quote: ${formatQuoteError(quoteResult)}`);
      return;
    }

    const quote = quoteResult.quote;
    if (shouldSkipForPriceImpact(quoteResult, config.maxBuyPriceImpactPct)) {
      const impact = jupiterPriceImpactPct(quote);
      await logSkip(
        swap,
        priceImpactSkipMessage(impact, config.maxBuyPriceImpactPct),
      );
      return;
    }

    const merged = mergeBuy(existing, swap, tradeSol, quote.outAmount);
    await upsertPosition(merged);
    await incrementTradesToday();
    const verb = averagedIn ? `Bijgekocht (#${merged.buyCount})` : "Zou kopen";
    const sourceNote = quoteSourceLabel(quoteResult.source);
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "copy_buy",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `[DRY RUN] ${verb} ${tradeSol} SOL op ${swap.mint}${convictionNote}${sourceNote}`,
      txSignature: swap.signature,
      metadata: {
        mode: "dry_run",
        quantity: merged.quantity ?? null,
        tradeSol,
        buyCount: merged.buyCount,
        averagedIn,
        quoteSource: quoteResult.source ?? null,
        ...sizingMeta,
      },
    });
    return;
  }

  try {
    const preQuoteResult = await getTradeQuote({
      inputMint: SOL_MINT,
      outputMint: swap.mint,
      amountLamports: Math.floor(tradeSol * LAMPORTS_PER_SOL),
      slippageBps: config.slippageBps,
    });
    if (preQuoteResult.quote) {
      if (shouldSkipForPriceImpact(preQuoteResult, config.maxBuyPriceImpactPct)) {
        const impact = jupiterPriceImpactPct(preQuoteResult.quote);
        await logSkip(
          swap,
          priceImpactSkipMessage(impact, config.maxBuyPriceImpactPct),
        );
        return;
      }
    }

    const result = await executeBuyTokenWithSol({
      mint: swap.mint,
      solAmount: tradeSol,
      slippageBps: config.slippageBps,
    });

    const merged = mergeBuy(existing, swap, tradeSol, result.quote.outAmount);
    await upsertPosition(merged);
    await incrementTradesToday();
    const verb = averagedIn ? `Bijgekocht (#${merged.buyCount})` : "Gekocht";
    const sourceNote = quoteSourceLabel(result.source);
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "copy_buy",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `${verb}: ${tradeSol} SOL → ${swap.mint}${convictionNote}${sourceNote}`,
      txSignature: result.signature,
      metadata: {
        tradeSol,
        buyCount: merged.buyCount,
        averagedIn,
        executionSource: result.source,
        ...sizingMeta,
      },
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

async function handleCopySell(
  swap: ParsedSwap,
  fraction: number,
): Promise<void> {
  const positions = await getPositions();
  const position = positions.find(
    (p) => p.mint === swap.mint && p.status === "open",
  );

  if (!position) {
    await logSkip(swap, "Geen open positie om te verkopen");
    return;
  }

  const remaining = safeBigInt(position.quantity);
  const sellFraction = Math.min(1, Math.max(0, fraction));
  // Bepaal hoeveel we verkopen. Geen quantity bekend, fractie ~volledig, of
  // de berekende portie wordt 0 → volledige sluiting.
  const sellQty =
    remaining > 0n
      ? (remaining * BigInt(Math.round(sellFraction * 1_000_000))) / 1_000_000n
      : 0n;
  const sellAll =
    sellFraction >= 0.999 || remaining <= 0n || sellQty <= 0n || sellQty >= remaining;

  if (isDryRun()) {
    if (sellAll) {
      const exitSol = await quoteSellSol(position);
      if (exitSol === null) {
        await addEvent({
          id: createEventId(),
          timestamp: new Date().toISOString(),
          type: "error",
          wallet: swap.wallet,
          mint: swap.mint,
          message: `[DRY RUN] Copy-sell mislukt — geen sell-quote beschikbaar`,
          txSignature: swap.signature,
          metadata: { mode: "dry_run" },
        });
        return;
      }
      const pnlSol = exitSol - position.entrySol;
      await finalizeClose(position, "copy_sell", position.entrySol + pnlSol, pnlSol);
      await recordTradeResult(pnlSol);
      await addEvent({
        id: createEventId(),
        timestamp: new Date().toISOString(),
        type: "copy_sell",
        wallet: swap.wallet,
        mint: swap.mint,
        message: `[DRY RUN] Positie gesloten op copy-sell (PnL ${pnlSol.toFixed(4)} SOL)`,
        txSignature: swap.signature,
        metadata: { mode: "dry_run", marketBased: true },
      });
      return;
    }

    const exitPortion = await quoteSellSolForAmount(position.mint, sellQty);
    const portionEntrySol =
      position.entrySol * (Number(sellQty) / Number(remaining));
    if (exitPortion === null) {
      await addEvent({
        id: createEventId(),
        timestamp: new Date().toISOString(),
        type: "error",
        wallet: swap.wallet,
        mint: swap.mint,
        message: `[DRY RUN] Deels verkopen mislukt — geen sell-quote beschikbaar`,
        txSignature: swap.signature,
        metadata: { mode: "dry_run", partial: true, sellFraction },
      });
      return;
    }
    const pnlSol = exitPortion - portionEntrySol;

    applyPartialSell(position, remaining - sellQty, portionEntrySol, pnlSol);
    await upsertPosition(position);
    await recordTradeResult(pnlSol);
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "copy_sell",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `[DRY RUN] Deels verkocht (${(sellFraction * 100).toFixed(0)}%, #${position.sellCount}) — PnL ${pnlSol.toFixed(4)} SOL`,
      txSignature: swap.signature,
      metadata: {
        mode: "dry_run",
        partial: true,
        sellFraction,
        sellCount: position.sellCount,
      },
    });
    return;
  }

  if (!position.quantity) {
    await logSkip(swap, "Geen token quantity opgeslagen voor sell");
    return;
  }

  const qtyToSell = sellAll ? remaining : sellQty;

  try {
    const result = await executeSellTokenForSol({
      mint: swap.mint,
      tokenAmount: qtyToSell.toString(),
      slippageBps: getBotConfig().slippageBps,
    });

    const exitSol = Number(result.quote.outAmount) / LAMPORTS_PER_SOL;

    if (sellAll) {
      const pnlSol = exitSol - position.entrySol;
      await finalizeClose(position, "copy_sell", exitSol, pnlSol);
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
      return;
    }

    const portionEntrySol =
      position.entrySol * (Number(qtyToSell) / Number(remaining));
    const pnlSol = exitSol - portionEntrySol;
    applyPartialSell(position, remaining - qtyToSell, portionEntrySol, pnlSol);
    await upsertPosition(position);
    await recordTradeResult(pnlSol);
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "copy_sell",
      wallet: swap.wallet,
      mint: swap.mint,
      message: `Deels verkocht (${(sellFraction * 100).toFixed(0)}%, #${position.sellCount}) — PnL ${pnlSol.toFixed(4)} SOL`,
      txSignature: result.signature,
      metadata: { partial: true, sellFraction, sellCount: position.sellCount },
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

/** Sluit een positie volledig en zet de slot-velden. */
async function finalizeClose(
  position: Position,
  reason: NonNullable<Position["closeReason"]>,
  exitSol: number,
  pnlSol: number,
): Promise<void> {
  position.status = "closed";
  position.closedAt = new Date().toISOString();
  position.closeReason = reason;
  position.exitSol = exitSol;
  // Totaal-PnL = eerder gerealiseerde porties + deze laatste sluiting.
  position.pnlSol = (position.realizedPnlSol ?? 0) + pnlSol;
  await upsertPosition(position);
}

/** Verwerkt een gedeeltelijke verkoop: verlaagt quantity + entrySol (cost basis). */
function applyPartialSell(
  position: Position,
  newRemaining: bigint,
  portionEntrySol: number,
  pnlSol: number,
): void {
  position.quantity = newRemaining.toString();
  position.entrySol = Math.max(0, position.entrySol - portionEntrySol);
  position.sellCount = (position.sellCount ?? 0) + 1;
  position.realizedPnlSol = (position.realizedPnlSol ?? 0) + pnlSol;
  position.lastSellAt = new Date().toISOString();
}

/**
 * Haalt de actuele SOL-waarde van een positie op via een Jupiter sell-quote.
 * Geeft `null` terug als er geen quantity of quote beschikbaar is.
 */
async function quoteSellSol(position: Position): Promise<number | null> {
  if (!position.quantity) return null;
  return quoteSellSolForAmount(position.mint, safeBigInt(position.quantity));
}

/** SOL-opbrengst van het verkopen van `tokenAmountRaw` base units van `mint`. */
async function quoteSellSolForAmount(
  mint: string,
  tokenAmountRaw: bigint,
): Promise<number | null> {
  if (tokenAmountRaw <= 0n) return null;

  const quoteResult = await getTradeQuote({
    inputMint: mint,
    outputMint: SOL_MINT,
    amountLamports: tokenAmountRaw,
    slippageBps: getBotConfig().slippageBps,
  });
  if (!quoteResult.quote) return null;

  const outSol = Number(quoteResult.quote.outAmount) / LAMPORTS_PER_SOL;
  return Number.isFinite(outSol) ? outSol : null;
}

function quoteSourceLabel(source: QuoteSource | undefined): string {
  if (source === "pump_bonding_curve") {
    return " (quote: pump.fun bonding curve)";
  }
  return "";
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
      updatePeakPnl(position, pnlPct);

      // Verlies: nooit zelf uithalen — alleen via target copy-sell.
      if (config.stopLossPct > 0 && pnlPct <= -config.stopLossPct) {
        await closePosition(position, "stop_loss", exitSol, pnlPct);
        continue;
      }

      const homerunAction = planHomerunExit(position, pnlPct, config);
      if (homerunAction.kind !== "none") {
        const sold = await sellPartialFromPosition(
          position,
          homerunAction.sellFractionOfRemaining,
          {
            label: homerunAction.label,
            reason: "take_profit",
          },
        );
        if (sold) {
          markHomerunTierDone(position, homerunAction);
          await upsertPosition(position);
        }
        continue;
      }

      if (config.takeProfitPct > 0 && pnlPct >= config.takeProfitPct) {
        await closePosition(position, "take_profit", exitSol, pnlPct);
        continue;
      }

      if (position.peakPnlPct !== undefined) {
        await upsertPosition(position);
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
        message: config.homerunTiersEnabled
          ? `Positie ouder dan 24u — verlies via target copy-sell; winst via homerun tiers`
          : `Positie ouder dan 24u — exit via target copy-sell`,
      });
    }
  }
}

/**
 * Verkoopt een fractie van de resterende positie (homerun tiers / trailing stop).
 */
async function sellPartialFromPosition(
  position: Position,
  sellFractionOfRemaining: number,
  context: { label: string; reason: "take_profit" },
): Promise<boolean> {
  const remaining = safeBigInt(position.quantity);
  if (remaining <= 0n) return false;

  const sellFraction = Math.min(1, Math.max(0, sellFractionOfRemaining));
  const sellQty =
    (remaining * BigInt(Math.round(sellFraction * 1_000_000))) / 1_000_000n;
  const sellAll =
    sellFraction >= 0.999 || sellQty <= 0n || sellQty >= remaining;

  if (sellAll) {
    const exitSol = await quoteSellSol(position);
    if (exitSol === null) {
      await addEvent({
        id: createEventId(),
        timestamp: new Date().toISOString(),
        type: "error",
        mint: position.mint,
        message: `${context.label} — geen sell-quote beschikbaar`,
        metadata: { reason: context.reason },
      });
      return false;
    }
    const pnlSol = exitSol - position.entrySol;
    await finalizeClose(position, context.reason, exitSol, pnlSol);
    await recordTradeResult(pnlSol);
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "position_close",
      mint: position.mint,
      message: isDryRun()
        ? `[DRY RUN] ${context.label} (PnL ${pnlSol.toFixed(4)} SOL)`
        : `${context.label} (PnL ${pnlSol.toFixed(4)} SOL)`,
      metadata: { reason: context.reason, homerun: true },
    });
    return true;
  }

  const exitPortion = await quoteSellSolForAmount(position.mint, sellQty);
  const portionEntrySol =
    position.entrySol * (Number(sellQty) / Number(remaining));
  if (exitPortion === null) {
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "error",
      mint: position.mint,
      message: `${context.label} — gedeeltelijke sell-quote mislukt`,
      metadata: { reason: context.reason, partial: true },
    });
    return false;
  }

  const pnlSol = exitPortion - portionEntrySol;

  if (isDryRun()) {
    applyPartialSell(position, remaining - sellQty, portionEntrySol, pnlSol);
    await recordTradeResult(pnlSol);
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "copy_sell",
      mint: position.mint,
      message: `[DRY RUN] ${context.label} — PnL ${pnlSol.toFixed(4)} SOL`,
      metadata: {
        mode: "dry_run",
        partial: true,
        sellFraction,
        reason: context.reason,
        homerun: true,
      },
    });
    return true;
  }

  if (!position.quantity) return false;

  try {
    const result = await executeSellTokenForSol({
      mint: position.mint,
      tokenAmount: sellQty.toString(),
      slippageBps: getBotConfig().slippageBps,
    });
    const exitSol = Number(result.quote.outAmount) / LAMPORTS_PER_SOL;
    const livePnlSol = exitSol - portionEntrySol;
    applyPartialSell(position, remaining - sellQty, portionEntrySol, livePnlSol);
    await recordTradeResult(livePnlSol);
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "copy_sell",
      mint: position.mint,
      message: `${context.label} — PnL ${livePnlSol.toFixed(4)} SOL`,
      txSignature: result.signature,
      metadata: {
        partial: true,
        sellFraction,
        reason: context.reason,
        homerun: true,
        executionSource: result.source,
      },
    });
    return true;
  } catch (error) {
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "error",
      mint: position.mint,
      message: `${context.label} mislukt: ${error instanceof Error ? error.message : "onbekend"}`,
      metadata: { reason: context.reason },
    });
    return false;
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
    await finalizeClose(position, reason, exitSolQuote, pnlSol);
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
    const result = await executeSellTokenForSol({
      mint: position.mint,
      tokenAmount: position.quantity,
      slippageBps: getBotConfig().slippageBps,
    });
    const exitSol = Number(result.quote.outAmount) / LAMPORTS_PER_SOL;
    const pnlSol = exitSol - position.entrySol;
    await finalizeClose(position, reason, exitSol, pnlSol);
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

export type ManualSellResult =
  | {
      ok: true;
      pnlSol: number;
      exitSol: number;
      signature?: string;
      dryRun: boolean;
    }
  | { ok: false; error: string };

/** Sluit een open positie volledig via het dashboard (handmatige sell). */
export async function manualSellPosition(
  positionId: string,
): Promise<ManualSellResult> {
  const positions = await getPositions();
  const position = positions.find(
    (p) => p.id === positionId && p.status === "open",
  );

  if (!position) {
    return { ok: false, error: "Open positie niet gevonden" };
  }

  if (!position.quantity) {
    return {
      ok: false,
      error: "Geen token quantity opgeslagen — verkopen niet mogelijk",
    };
  }

  const remaining = safeBigInt(position.quantity);
  if (remaining <= 0n) {
    return { ok: false, error: "Positie heeft geen tokens meer" };
  }

  const config = getBotConfig();
  const dryRun = isDryRun();

  if (dryRun) {
    const exitSol = await quoteSellSol(position);
    if (exitSol === null) {
      await addEvent({
        id: createEventId(),
        timestamp: new Date().toISOString(),
        type: "error",
        mint: position.mint,
        message: "[DRY RUN] Handmatige sell mislukt — geen sell-quote beschikbaar",
        metadata: { mode: "dry_run", reason: "manual" },
      });
      return { ok: false, error: "Geen sell-quote beschikbaar" };
    }

    const pnlSol = exitSol - position.entrySol;
    await finalizeClose(position, "manual", exitSol, pnlSol);
    await recordTradeResult(pnlSol);
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "position_close",
      mint: position.mint,
      message: `[DRY RUN] Handmatig verkocht (PnL ${pnlSol.toFixed(4)} SOL)`,
      metadata: { mode: "dry_run", reason: "manual" },
    });
    return { ok: true, pnlSol, exitSol, dryRun: true };
  }

  try {
    const result = await executeSellTokenForSol({
      mint: position.mint,
      tokenAmount: remaining.toString(),
      slippageBps: config.slippageBps,
    });

    const exitSol = Number(result.quote.outAmount) / LAMPORTS_PER_SOL;
    const pnlSol = exitSol - position.entrySol;
    await finalizeClose(position, "manual", exitSol, pnlSol);
    await recordTradeResult(pnlSol);
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "position_close",
      mint: position.mint,
      message: `Handmatig verkocht (PnL ${pnlSol.toFixed(4)} SOL)`,
      txSignature: result.signature,
      metadata: { reason: "manual", executionSource: result.source },
    });

    return {
      ok: true,
      pnlSol,
      exitSol,
      signature: result.signature,
      dryRun: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "onbekend";
    await addEvent({
      id: createEventId(),
      timestamp: new Date().toISOString(),
      type: "error",
      mint: position.mint,
      message: `Handmatige sell mislukt: ${message}`,
      metadata: { reason: "manual" },
    });
    return { ok: false, error: message };
  }
}
