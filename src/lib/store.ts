import { Redis } from "@upstash/redis";
import type {
  BotStats,
  Position,
  TargetWallet,
  TradeEvent,
} from "./types";
import { getBotConfig, isBotEnabled, isDryRun } from "./config";

const KEYS = {
  events: "bot:events",
  positions: "bot:positions",
  stats: "bot:stats",
  targets: "bot:targets",
  tradesToday: "bot:trades_today",
  tradesTodayDate: "bot:trades_today_date",
  startTime: "bot:start_time",
  realizedPnl: "bot:realized_pnl",
  totalTrades: "bot:total_trades",
  wins: "bot:wins",
  losses: "bot:losses",
  botEnabled: "bot:enabled",
} as const;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/** Upstash deserializes JSON automatically — values may already be objects. */
function parseStoredJson<T>(raw: unknown): T {
  if (typeof raw === "string") {
    return JSON.parse(raw) as T;
  }
  return raw as T;
}

function storedScalarToString(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return JSON.stringify(raw);
}

function memoryStore(): Map<string, string> {
  const g = globalThis as typeof globalThis & {
    __copyBotMemory?: Map<string, string>;
  };
  if (!g.__copyBotMemory) {
    g.__copyBotMemory = new Map();
  }
  return g.__copyBotMemory;
}

async function kvGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    const value = await redis.get(key);
    return storedScalarToString(value);
  }
  return memoryStore().get(key) ?? null;
}

async function kvSet(key: string, value: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(key, value);
    return;
  }
  memoryStore().set(key, value);
}

async function kvLpush(key: string, value: string, max = 200): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.lpush(key, value);
    await redis.ltrim(key, 0, max - 1);
    return;
  }
  const raw = memoryStore().get(key);
  const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
  list.unshift(value);
  memoryStore().set(key, JSON.stringify(list.slice(0, max)));
}

async function kvLrange(key: string, start: number, end: number): Promise<unknown[]> {
  const redis = getRedis();
  if (redis) {
    const items = await redis.lrange(key, start, end);
    return items ?? [];
  }
  const raw = memoryStore().get(key);
  const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
  return list.slice(start, end + 1);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function ensureStartTime(): Promise<void> {
  const existing = await kvGet(KEYS.startTime);
  if (!existing) {
    await kvSet(KEYS.startTime, new Date().toISOString());
  }
}

export async function addEvent(event: TradeEvent): Promise<void> {
  await kvLpush(KEYS.events, JSON.stringify(event));
}

export async function getRecentEvents(limit = 50): Promise<TradeEvent[]> {
  const items = await kvLrange(KEYS.events, 0, limit - 1);
  return items.map((item) => parseStoredJson<TradeEvent>(item));
}

export async function getPositions(): Promise<Position[]> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get(KEYS.positions);
    if (!raw) return [];
    return parseStoredJson<Position[]>(raw);
  }
  const raw = memoryStore().get(KEYS.positions);
  if (!raw) return [];
  return JSON.parse(raw) as Position[];
}

export async function savePositions(positions: Position[]): Promise<void> {
  await kvSet(KEYS.positions, JSON.stringify(positions));
}

export async function upsertPosition(position: Position): Promise<void> {
  const positions = await getPositions();
  const index = positions.findIndex((p) => p.id === position.id);
  if (index >= 0) {
    positions[index] = position;
  } else {
    positions.push(position);
  }
  await savePositions(positions);
}

export async function getTargets(): Promise<TargetWallet[]> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get(KEYS.targets);
    if (raw === null || raw === undefined) {
      const defaults = getBotConfig().targets;
      await redis.set(KEYS.targets, defaults);
      return defaults;
    }
    return parseStoredJson<TargetWallet[]>(raw);
  }
  const raw = memoryStore().get(KEYS.targets);
  if (!raw) {
    const defaults = getBotConfig().targets;
    memoryStore().set(KEYS.targets, JSON.stringify(defaults));
    return defaults;
  }
  return JSON.parse(raw) as TargetWallet[];
}

export async function saveTargets(targets: TargetWallet[]): Promise<void> {
  await kvSet(KEYS.targets, JSON.stringify(targets));
}

export async function getTradesToday(): Promise<number> {
  const date = await kvGet(KEYS.tradesTodayDate);
  if (date !== todayKey()) {
    await kvSet(KEYS.tradesTodayDate, todayKey());
    await kvSet(KEYS.tradesToday, "0");
    return 0;
  }
  const count = await kvGet(KEYS.tradesToday);
  return Number(count ?? "0");
}

export async function incrementTradesToday(): Promise<number> {
  const current = await getTradesToday();
  const next = current + 1;
  await kvSet(KEYS.tradesToday, String(next));
  await kvSet(KEYS.tradesTodayDate, todayKey());
  return next;
}

export async function recordTradeResult(pnlSol: number): Promise<void> {
  const total = Number((await kvGet(KEYS.totalTrades)) ?? "0") + 1;
  await kvSet(KEYS.totalTrades, String(total));

  if (pnlSol >= 0) {
    const wins = Number((await kvGet(KEYS.wins)) ?? "0") + 1;
    await kvSet(KEYS.wins, String(wins));
  } else {
    const losses = Number((await kvGet(KEYS.losses)) ?? "0") + 1;
    await kvSet(KEYS.losses, String(losses));
  }

  const realized = Number((await kvGet(KEYS.realizedPnl)) ?? "0") + pnlSol;
  await kvSet(KEYS.realizedPnl, String(realized));
}

export async function setBotEnabled(enabled: boolean): Promise<void> {
  await kvSet(KEYS.botEnabled, enabled ? "true" : "false");
}

export async function getBotEnabledState(): Promise<boolean> {
  const stored = await kvGet(KEYS.botEnabled);
  if (stored === null) return isBotEnabled();
  return stored === "true";
}

export async function getStats(balanceSol = 0): Promise<BotStats> {
  await ensureStartTime();
  const events = await getRecentEvents(1);
  const positions = await getPositions();
  const openPositions = positions.filter((p) => p.status === "open");

  return {
    balanceSol,
    openPositions: openPositions.length,
    totalTrades: Number((await kvGet(KEYS.totalTrades)) ?? "0"),
    wins: Number((await kvGet(KEYS.wins)) ?? "0"),
    losses: Number((await kvGet(KEYS.losses)) ?? "0"),
    realizedPnlSol: Number((await kvGet(KEYS.realizedPnl)) ?? "0"),
    tradesToday: await getTradesToday(),
    lastEventAt: events[0]?.timestamp,
    botEnabled: await getBotEnabledState(),
    mode: isDryRun() ? "dry_run" : "live",
    uptimeSince: (await kvGet(KEYS.startTime)) ?? undefined,
  };
}

export function createEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
