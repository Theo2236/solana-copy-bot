# Solana Copy Bot

24/7 Solana meme-coin copy-trading bot met monitoring dashboard, gebouwd voor Vercel.

## Wat het doet

- Volgt 7 vooraf geselecteerde winning wallets (Cented, Theo, Decu, Cupsey, Kadenox, The Doc, Sheep)
- Ontvangt swaps via **Helius webhooks** (real-time)
- Backup polling via **Vercel Cron** (1× per dag op Hobby plan) of externe cron
- Kopieert buys/sells via **Jupiter** + **pump.fun bonding curve** (live én dry-run)
- Slaat trades, posities en events op in **Upstash Redis**
- Monitoring via ingebouwde **webapp dashboard**

## Architectuur

```
Next.js (Vercel)
├── Dashboard (/)
├── /api/webhook/helius     → real-time swap events
├── /api/cron/poll          → backup polling (1×/dag op Hobby)
├── /api/poll               → handmatige refresh (dashboard)
├── /api/cron/refresh-wallets
├── /api/stats              → dashboard data
├── /api/setup/webhook      → Helius webhook registratie
└── /api/bot/toggle         → bot aan/uit
```

## Snel starten

### 1. Dependencies

```bash
npm install
```

### 2. Environment variables

Kopieer `.env.example` naar `.env.local` en vul in:

| Variabele | Vereist | Beschrijving |
|-----------|---------|--------------|
| `HELIUS_API_KEY` | Ja | RPC + webhooks + tx history |
| `UPSTASH_REDIS_REST_URL` | Ja (prod) | Persistente state |
| `UPSTASH_REDIS_REST_TOKEN` | Ja (prod) | Redis token |
| `CRON_SECRET` | Ja (prod) | Beveiligt cron endpoints |
| `DASHBOARD_PASSWORD` | Aanbevolen | Dashboard login |
| `BOT_WALLET_PRIVATE_KEY` | Live only | Bot wallet voor swaps |
| `BOT_MODE` | Nee | `dry_run` (default) of `live` |

### 3. Lokaal draaien

```bash
npm run dev
```

Open http://localhost:3000 voor het dashboard.

### 4. Deploy naar Vercel

```bash
npx vercel
```

Of koppel de GitHub repo in het Vercel dashboard.

### 5. Na deploy

1. Zet alle env vars in Vercel Project Settings
2. Maak een gratis [Upstash Redis](https://upstash.com) database aan
3. Maak een [Helius](https://helius.dev) API key aan
4. Open je dashboard en klik **Helius webhook registreren**
5. Test met `BOT_MODE=dry_run` voordat je live gaat

## Live trading inschakelen

⚠️ **Hoog risico met klein budget (~€100)**

1. Maak een **aparte** Solana wallet aan voor de bot
2. Stort ~0.65 SOL (+ reserve voor pump.fun volume accumulator rent ~0.002 SOL)
3. Zet `BOT_WALLET_PRIVATE_KEY` (base58)
4. Zet `BOT_MODE=live`
5. Deploy opnieuw

### pump.fun in live mode

Verse pump.fun-tokens (eindigen op `pump`) worden vaak nog niet door Jupiter gerouteerd. De bot:

1. Probeert eerst **Jupiter** (lite-api)
2. Valt terug op **pump.fun bonding curve** via `@pump-fun/pump-sdk` voor buys/sells op de curve
3. Na graduation (token verlaat bonding curve) gaat alles via Jupiter

Dit werkt identiek in dry-run (quote) en live (on-chain executie).

## Backup polling (webhook uitval)

Vercel Hobby staat maximaal **1 cron per dag** toe. Voor frequentere backup-polls:

```bash
# Elke 5 minuten via externe cron (bijv. cron-job.org)
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://jouw-app.vercel.app/api/cron/poll
```

De dashboard **Refresh**-knop triggert `/api/poll` direct (8 swaps per wallet).

## Gevolgde wallets (defaults)

| Trader | Adres | 30d PnL | Winrate |
|--------|-------|---------|---------|
| Cented | `CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o` | +4457 SOL | 52% |
| Theo | `Bi4rd5FH5bYEN8scZ7wevxNZyNmKHdaBcvewdPFxYdLt` | +3161 SOL | 42% |
| Decu | `4vw54BmAogeRV3vPKWyFet5yf8DTLcREzdSzx4rw9Ud9` | +1257 SOL | 48% |
| Cupsey | `2fg5QD1eD7rzNNCsvnhmXFm5hqNgwTTG8p7kQ6f3rx6f` | +369 SOL | 42% |
| Kadenox | `B32QbbdDAyhvUQzjcaM5j6ZVKwjCxAwGH5Xgvb9SJqnC` | +435 SOL | 52% |
| The Doc | `DYAn4XpAkN5mhiXkRB7dGq4Jadnx6XYgu8L5b3WGhbrt` | +189 SOL | 48% |
| Sheep | `78N177fzNJpp8pG49xDv1efYcTMSzo9tPTKEA9mAVkh2` | +380 SOL | 50% |

Handmatig toegevoegde wallets blijven behouden bij de dagelijkse `refresh-wallets` cron.

## Risico-instellingen (defaults)

- 0.03 SOL basis per trade (conviction-modus schaalt met wallet-inzet target)
- Copy range 0.02–0.08 SOL
- Max 2 open posities
- **Stop-loss uit** — verlies-exit alleen via target copy-sell
- **Homerun tiers**: +100% → 50% uit (inleg terug), +400% → extra 25%, moon bag met 20% trailing stop
- Min target-inzet 2% wallet (filtert ruis-trades)
- Min liquiditeit $2.000 (Dexscreener; verse pump-tokens met $0 worden doorgelaten)
- 300 bps slippage
- Auto-disable targets: ≥3 gesloten trades én PnL < -0.05 SOL

## API endpoints

| Endpoint | Methode | Beschrijving |
|----------|---------|--------------|
| `/api/health` | GET | Health check |
| `/api/stats` | GET | Dashboard data |
| `/api/webhook/helius` | POST | Helius swap webhook |
| `/api/cron/poll` | GET | Backup polling (cron) |
| `/api/poll` | POST | Handmatige poll (dashboard) |
| `/api/setup/webhook` | POST | Webhook registreren |
| `/api/bot/toggle` | POST | Bot aan/uit |

## Belangrijke waarschuwingen

- Dit is een **leerproject** — meme coins zijn extreem risicovol
- Verwacht mogelijk verlies van €20–50 bij €100 budget
- Gebruik nooit je hoofd-wallet als bot wallet
- Start altijd in `dry_run` modus
- Phantom MCP werkt **niet** op Vercel — de bot gebruikt Jupiter + pump.fun SDK + eigen wallet

Zie ook [docs/HANDOFF.md](docs/HANDOFF.md) voor overzetten naar een andere PC.

MIT
