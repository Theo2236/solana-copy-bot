# Handoff — Solana Copy Bot

Overzicht om het project op een andere PC (vaste computer) verder te zetten.

## Repository

- **GitHub:** https://github.com/Theo2236/solana-copy-bot
- **Vercel (prod):** gekoppeld aan `master` branch
- **Kwaliteitsbranch:** `chore/quality-baseline` → PRs naar `master`

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

## Kwaliteitsworkflow (2026)

| Fase | Status | Inhoud |
|------|--------|--------|
| Docs + `.env.example` | ✅ | Onboarding, README sync |
| Auth hardening | ✅ | Fail-closed in productie |
| Error handling | ✅ | API wrapper, webhook sync |
| Tests (Vitest) | ✅ | Unit tests kernmodules |
| CI (GitHub Actions) | ✅ | lint + test + build |

```bash
npm run lint
npm test
npm run build
```

Project-skill voor agents: `.cursor/skills/solana-copy-bot/SKILL.md`

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
| Unit tests + CI | ✅ |

### Belangrijke fixes

1. **Upstash JSON** — Redis deserialiseert JSON automatisch; `store.ts` parseert niet dubbel.
2. **Dry-run saldo** — Balance-check alleen in live modus (`copy-engine.ts`).
3. **Vercel cron** — Hobby plan: poll 1×/dag (`0 8 * * *`), niet elke 5 min.
4. **Auth prod** — Zonder secrets zijn cron/dashboard/webhook geblokkeerd (`auth.ts`).
5. **Webhook sync** — Target toggle/add/remove herregistreert Helius webhook.

## Environment variables (Vercel)

Deze staan al in Vercel Project Settings (niet in git). Zie `.env.example` voor volledige lijst.

| Variabele | Doel |
|-----------|------|
| `HELIUS_API_KEY` | RPC + webhooks |
| `UPSTASH_REDIS_REST_URL` | Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Redis token |
| `CRON_SECRET` | Cron endpoints |
| `DASHBOARD_PASSWORD` | Dashboard login |
| `HELIUS_WEBHOOK_SECRET` | Webhook beveiliging |
| `BOT_MODE` | `dry_run` of `live` |

Pull env vars op vaste PC:

```bash
npx vercel link
npx vercel env pull .env.local
```

## Cursor / agent context

Volledige chatgeschiedenis staat lokaal in Cursor (niet in git). Op vaste PC: open dezelfde repo in Cursor; chatgeschiedenis sync niet automatisch — gebruik dit document + README + project-skill.

## Backlog (niet in quality-sprint)

- [ ] Live trading: bot-wallet + `BOT_MODE=live`
- [ ] Externe cron elke 5 min (cron-job.org) voor webhook-fallback
- [ ] E2E tests (Playwright) voor dashboard flow
- [ ] Positie auto-close na 24u
- [ ] Dexscreener fail-closed toggle
- [ ] Caveman Code: `npm i -g @juliusbrussee/caveman-code` + `/login` voor terminal-agent
