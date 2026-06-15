import type { BotConfig } from "./types";

export const DEFAULT_TARGETS = [
  {
    address: "4BdKaxN8G6ka4GYtQQWk4G4dZRUTX2vQH9GcXdBREFUk",
    label: "Jijo",
    pnl30dSol: 835,
    winRate: 67,
    enabled: true,
  },
  {
    address: "78N177fzNJpp8pG49xDv1efYcTMSzo9tPTKEA9mAVkh2",
    label: "Sheep",
    pnl30dSol: 628,
    winRate: 58,
    enabled: true,
  },
  {
    address: "B32QbbdDAyhvUQzjcaM5j6ZVKwjCxAwGH5Xgvb9SJqnC",
    label: "Kadenox",
    pnl30dSol: 413,
    winRate: 58,
    enabled: true,
  },
  {
    address: "DYAn4XpAkN5mhiXkRB7dGq4Jadnx6XYgu8L5b3WGhbrt",
    label: "The Doc",
    pnl30dSol: 189,
    winRate: 48,
    enabled: true,
  },
] as const;

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const WRAPPED_SOL_MINT = SOL_MINT;

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
    minCopyTradeSol: Number(process.env.MIN_COPY_TRADE_SOL ?? "0.01"),
    maxCopyTradeSol: Number(process.env.MAX_COPY_TRADE_SOL ?? String(tradeSizeSol * 5)),
    maxOpenPositions: Number(process.env.MAX_OPEN_POSITIONS ?? "3"),
    maxTradesPerDay: Number(process.env.MAX_TRADES_PER_DAY ?? "5"),
    stopLossPct: Number(process.env.STOP_LOSS_PCT ?? "30"),
    takeProfitPct: Number(process.env.TAKE_PROFIT_PCT ?? "100"),
    maxDrawdownEur: Number(process.env.MAX_DRAWDOWN_EUR ?? "20"),
    minLiquidityUsd: Number(process.env.MIN_LIQUIDITY_USD ?? "50000"),
    minTokenAgeHours: Number(process.env.MIN_TOKEN_AGE_HOURS ?? "1"),
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
