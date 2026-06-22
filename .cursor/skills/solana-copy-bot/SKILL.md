---
name: solana-copy-bot
description: >-
  Solana meme-coin copy-trading bot op Vercel. Gebruik bij wijzigingen aan
  copy-engine, webhooks, Redis state, dashboard, Jupiter/pump.fun trades of
  deploy/env-configuratie.
---

# Solana Copy Bot

## Architectuur

```
Helius webhook / cron poll → parseHeliusSwap → copy-engine processSwap
  → trade-quote (Jupiter → pump bonding curve) → trade-execute (dry_run/live)
  → store.ts (Upstash Redis) → /api/stats → Dashboard
```

Kernbestanden:
- `src/lib/copy-engine.ts` — copy-logica, filters, homerun exits
- `src/lib/store.ts` — Redis keys `bot:*` (events, positions, stats, targets)
- `src/lib/helius.ts` — webhook parsing + registratie
- `src/lib/trade-quote.ts` / `trade-execute.ts` — quotes en uitvoering
- `src/lib/pump-quote.ts` — pump.fun frontend API (bonding curve quotes)
- `src/lib/pump-swap.ts` — PumpPortal live trades

## Modus

- `BOT_MODE=dry_run` (default): simuleert trades, geen on-chain swaps
- `BOT_MODE=live`: vereist `BOT_WALLET_PRIVATE_KEY` (base58)

## Auth (productie = fail-closed)

- Cron: `Authorization: Bearer $CRON_SECRET`
- Dashboard: header `x-dashboard-password` of `?password=`
- Webhook: `Authorization: $HELIUS_WEBHOOK_SECRET`

Zonder secrets in `NODE_ENV=production` zijn endpoints geblokkeerd.

## Redis keys

| Key | Inhoud |
|-----|--------|
| `bot:events` | Recente trade events (list) |
| `bot:positions` | Open/gesloten posities |
| `bot:stats` | Aggregated stats |
| `bot:targets` | Target wallets |
| `bot:enabled` | Bot aan/uit flag |

Zonder Upstash: in-memory fallback (niet persistent op Vercel).

## pump.fun fallback

1. Jupiter lite-api quote/swap
2. pump.fun bonding curve (`pump-quote.ts`) voor quotes
3. PumpPortal (`pump-swap.ts`) voor live pump trades

Geen `@pump-fun/pump-sdk` — alleen HTTP APIs.

## Kwaliteitsworkflow

Branch `chore/quality-baseline` → PRs naar `master`. Tests: `npm test`. CI: lint + test + build.

## Multi-agent

- **explore** — codebase audit
- **builder** — implementatie
- **reviewer** — bugbot + security vóór merge
- **ops** — Vercel deploy, env pull
