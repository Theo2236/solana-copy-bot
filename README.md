# Solana Copy Bot

24/7 Solana meme-coin copy-trading bot met monitoring dashboard, gebouwd voor Vercel.

## Wat het doet

- Volgt 4 vooraf geselecteerde winning wallets (Jijo, Sheep, Kadenox, The Doc)
- Ontvangt swaps via **Helius webhooks** (real-time)
- Backup polling elke 5 minuten via **Vercel Cron**
- Kopieert buys/sells via **Jupiter API**
- Slaat trades, posities en events op in **Upstash Redis**
- Monitoring via ingebouwde **webapp dashboard**

## Architectuur

```
Next.js (Vercel)
├── Dashboard (/)
├── /api/webhook/helius     → real-time swap events
├── /api/cron/poll          → backup polling (elke 5 min)
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
2. Stort ~0.65 SOL
3. Zet `BOT_WALLET_PRIVATE_KEY` (base58)
4. Zet `BOT_MODE=live`
5. Deploy opnieuw

## Gevolgde wallets

| Trader | Adres | 30d PnL | Winrate |
|--------|-------|---------|---------|
| Jijo | `4BdKaxN8G6ka4GYtQQWk4G4dZRUTX2vQH9GcXdBREFUk` | +835 SOL | 67% |
| Sheep | `78N177fzNJpp8pG49xDv1efYcTMSzo9tPTKEA9mAVkh2` | +628 SOL | 58% |
| Kadenox | `B32QbbdDAyhvUQzjcaM5j6ZVKwjCxAwGH5Xgvb9SJqnC` | +413 SOL | 58% |
| The Doc | `DYAn4XpAkN5mhiXkRB7dGq4Jadnx6XYgu8L5b3WGhbrt` | +189 SOL | 48% |

## Risico-instellingen (defaults)

- 0.05 SOL per trade
- Max 3 open posities
- Max 5 trades per dag
- Stop-loss -30%, take-profit +100%
- 300 bps slippage

## API endpoints

| Endpoint | Methode | Beschrijving |
|----------|---------|--------------|
| `/api/health` | GET | Health check |
| `/api/stats` | GET | Dashboard data |
| `/api/webhook/helius` | POST | Helius swap webhook |
| `/api/cron/poll` | GET | Backup polling (cron) |
| `/api/setup/webhook` | POST | Webhook registreren |
| `/api/bot/toggle` | POST | Bot aan/uit |

## Belangrijke waarschuwingen

- Dit is een **leerproject** — meme coins zijn extreem risicovol
- Verwacht mogelijk verlies van €20–50 bij €100 budget
- Gebruik nooit je hoofd-wallet als bot wallet
- Start altijd in `dry_run` modus
- Phantom MCP werkt **niet** op Vercel — de bot gebruikt Jupiter + eigen wallet

## Licentie

MIT
