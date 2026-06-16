import type { BotConfig } from "./types";

export const DEFAULT_TARGETS = [
  {
    address: "CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o",
    label: "Cented",
    pnl30dSol: 4457,
    winRate: 52,
    enabled: true,
  },
  {
    address: "Bi4rd5FH5bYEN8scZ7wevxNZyNmKHdaBcvewdPFxYdLt",
    label: "Theo",
    pnl30dSol: 3161,
    winRate: 42,
    enabled: true,
  },
  {
    address: "4vw54BmAogeRV3vPKWyFet5yf8DTLcREzdSzx4rw9Ud9",
    label: "Decu",
    pnl30dSol: 1257,
    winRate: 48,
    enabled: true,
  },
  {
    address: "2fg5QD1eD7rzNNCsvnhmXFm5hqNgwTTG8p7kQ6f3rx6f",
    label: "Cupsey",
    pnl30dSol: 369,
    winRate: 42,
    enabled: true,
  },
  {
    address: "B32QbbdDAyhvUQzjcaM5j6ZVKwjCxAwGH5Xgvb9SJqnC",
    label: "Kadenox",
    pnl30dSol: 435,
    winRate: 52,
    enabled: true,
  },
  {
    address: "DYAn4XpAkN5mhiXkRB7dGq4Jadnx6XYgu8L5b3WGhbrt",
    label: "The Doc",
    pnl30dSol: 189,
    winRate: 48,
    enabled: true,
  },
  {
    address: "78N177fzNJpp8pG49xDv1efYcTMSzo9tPTKEA9mAVkh2",
    label: "Sheep",
    pnl30dSol: 380,
    winRate: 50,
    enabled: true,
  },
] as const;

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const WRAPPED_SOL_MINT = SOL_MINT;

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

/**
 * Mints die we NIET als memecoin-trade behandelen: SOL (+ wrapped), stablecoins
 * en de grote liquid-staking tokens. Een swap van SOL → USDC is geen copy-trade
 * maar een trader die winst vastzet; die negeren we volledig.
 */
export const NON_MEMECOIN_MINTS = new Set<string>([
  SOL_MINT,
  USDC_MINT,
  USDT_MINT,
  "USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX", // USDH
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // Wormhole USDC (USDCet)
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", // mSOL
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // jitoSOL
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", // bSOL
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj", // stSOL
]);

/** True als de mint een echte (copyable) memecoin is, geen stablecoin/SOL. */
export function isCopyableMint(mint: string): boolean {
  return !NON_MEMECOIN_MINTS.has(mint);
}

/** Stablecoins die traders als funding-valuta gebruiken, met hun decimals. */
export const STABLECOIN_DECIMALS: Record<string, number> = {
  [USDC_MINT]: 6,
  [USDT_MINT]: 6,
  USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX: 6,
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: 6,
};

export function isStablecoinMint(mint: string): boolean {
  return mint in STABLECOIN_DECIMALS;
}

function copySizeModeFromEnv(): BotConfig["copySizeMode"] {
  const raw = process.env.COPY_SIZE_MODE?.trim().toLowerCase();
  return raw === "fixed" ? "fixed" : "conviction";
}

export function getBotConfig(): BotConfig {
  const tradeSizeSol = Number(process.env.TRADE_SIZE_SOL ?? "0.05");

  return {
    tradeSizeSol,
    copySizeMode: copySizeModeFromEnv(),
    referenceConvictionPct: Number(process.env.COPY_REFERENCE_CONVICTION_PCT ?? "0.1"),
    minCopyTradeSol: Number(process.env.MIN_COPY_TRADE_SOL ?? "0.02"),
    maxCopyTradeSol: Number(process.env.MAX_COPY_TRADE_SOL ?? "1.0"),
    maxOpenPositions: Number(process.env.MAX_OPEN_POSITIONS ?? "3"),
    stopLossPct: Number(process.env.STOP_LOSS_PCT ?? "30"),
    // 0 = uit — pump.fun is alles-of-niets; exit via target copy-sell (of SL).
    takeProfitPct: Number(process.env.TAKE_PROFIT_PCT ?? "0"),
    maxDrawdownEur: Number(process.env.MAX_DRAWDOWN_EUR ?? "20"),
    // Laag gehouden zodat verse pump.fun-memecoins (waar de target-wallets de
    // meeste winst maken) niet worden weggefilterd. De price-impact-guard op de
    // quote beschermt tegen écht illiquide tokens.
    minLiquidityUsd: Number(process.env.MIN_LIQUIDITY_USD ?? "2000"),
    minTokenAgeHours: Number(process.env.MIN_TOKEN_AGE_HOURS ?? "0"),
    slippageBps: Number(process.env.SLIPPAGE_BPS ?? "300"),
    targets: DEFAULT_TARGETS.map((t) => ({ ...t })),
  };
}

export function isDryRun(): boolean {
  return process.env.BOT_MODE !== "live";
}

export function isBotEnabled(): boolean {
  return process.env.BOT_ENABLED !== "false";
}

export function getRpcUrl(): string {
  const heliusKey = process.env.HELIUS_API_KEY;
  if (heliusKey) {
    return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
  }
  return process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
}

export function getHeliusApiKey(): string | undefined {
  return process.env.HELIUS_API_KEY;
}

export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET;
}

export function getDashboardPassword(): string | undefined {
  return process.env.DASHBOARD_PASSWORD;
}

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
