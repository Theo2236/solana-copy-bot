# Handoff — Solana Copy Bot

Overzicht om het project op een andere PC (vaste computer) verder te zetten.

## Repository

- **GitHub:** https://github.com/Theo2236/solana-copy-bot
- **Vercel (prod):** gekoppeld aan `master` branch

## Op vaste PC starten

```bash
git clone https://github.com/Theo2236/solana-copy-bot.git
cd solana-copy-bot
npm install
cp .env.example .env.local
# Vul .env.local in (zie README)
npm run dev
```

Open http://localhost:3000 — dashboard-wachtwoord staat in Vercel env (`DASHBOARD_PASSWORD`) of lokaal in `.env.local`.

## Wat agents hebben gebouwd (sessie-overzicht)

| Onderdeel | Status |
|-----------|--------|
| Next.js bot + dashboard | ✅ |
| Helius webhook + cron poll | ✅ |
| Upstash Redis state | ✅ |
| Dry-run modus | ✅ getest |
| pump.fun live (PumpPortal) | ✅ |
| Dashboard wachtwoord | ✅ |
| EUR winst + SOL koers (CoinGecko) | ✅ |
| Positie-historie tabel | ✅ |
| Vercel deploy | ✅ |

### Belangrijke fixes

1. **Upstash JSON** — Redis deserialiseert JSON automatisch; `store.ts` parseert niet dubbel.
2. **Dry-run saldo** — Balance-check alleen in live modus (`copy-engine.ts`).
3. **Vercel cron** — Hobby plan: poll 1×/dag (`0 8 * * *`), niet elke 5 min.

## Environment variables (Vercel)

Deze staan al in Vercel Project Settings (niet in git):

| Variabele | Doel |
|-----------|------|
| `HELIUS_API_KEY` | RPC + webhooks |
| `UPSTASH_REDIS_REST_URL` | Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Redis token |
| `CRON_SECRET` | Cron endpoints |
| `DASHBOARD_PASSWORD` | Dashboard login |
| `BOT_MODE` | `dry_run` of `live` |

Pull env vars op vaste PC:

```bash
npx vercel link
npx vercel env pull .env.local
```

## Cursor / agent context

Volledige chatgeschiedenis staat lokaal in Cursor (niet in git):

`~/.cursor/projects/.../agent-transcripts/1f7cb511-c7a1-482b-9c2a-dfc3f93fe2f7/`

Op vaste PC: open dezelfde repo in Cursor; chatgeschiedenis sync niet automatisch — gebruik dit document + README.

## Volgende stappen (optioneel)

- [ ] Live trading: bot-wallet + `BOT_MODE=live`
- [ ] Commit/push blijft sync houden tussen PC's
- [ ] Caveman Code: `npm i -g @juliusbrussee/caveman-code` + `/login` voor terminal-agent
