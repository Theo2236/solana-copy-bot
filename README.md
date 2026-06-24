# Pokémon Kaart Bulk Scanner

AI-powered bulk scanner voor Pokémon TCG kaarten. Upload één foto met meerdere kaarten (bijv. 10 stuks) en de app:

1. **Herken** elke kaart via Vision AI (Gemini of OpenAI)
2. **Zoek** de kaart op in de [Pokémon TCG API](https://pokemontcg.io/)
3. **Toon** marktprijzen (TCGPlayer, USD) en een totale collectiewaarde

## Demo flow

```
Foto (10 kaarten) → Vision AI → kaartnamen/set/nummers → Pokémon TCG API → prijzen + totaal
```

## Snel starten

### 1. Installeren

```bash
npm install
cp .env.example .env.local
```

### 2. API keys instellen

| Variabele | Vereist | Beschrijving |
|-----------|---------|--------------|
| `GEMINI_API_KEY` | Eén van beide | [Google AI Studio](https://aistudio.google.com/apikey) — aanbevolen |
| `OPENAI_API_KEY` | Eén van beide | Fallback vision provider |
| `POKEMON_TCG_API_KEY` | Aanbevolen | Gratis op [dev.pokemontcg.io](https://dev.pokemontcg.io/) |

### 3. Starten

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), upload een foto en wacht op de scan.

## Deploy op Vercel

**Live (productie):** https://solana-copy-bot.vercel.app

**Preview:** elke branch krijgt automatisch een Vercel preview URL.

### Environment variables (verplicht voor scans)

Voeg deze toe in [Vercel Project Settings → Environment Variables](https://vercel.com/theo2236s-projects/solana-copy-bot/settings/environment-variables):

| Variabele | Beschrijving |
|-----------|--------------|
| `GEMINI_API_KEY` | Vision AI ([Google AI Studio](https://aistudio.google.com/apikey)) |
| `POKEMON_TCG_API_KEY` | Prijsdata ([dev.pokemontcg.io](https://dev.pokemontcg.io/)) |

### Nieuwe GitHub repository

De cloud agent kan geen nieuwe repo aanmaken (beperkte GitHub-rechten). Zo migreer je handmatig:

1. Maak een lege repo aan op https://github.com/new → `pokemon-card-bulk-scanner`
2. Voer uit: `./scripts/migrate-to-new-github.sh JOUW-USERNAME/pokemon-card-bulk-scanner`
3. Importeer de nieuwe repo in [Vercel](https://vercel.com/new) en voeg de env vars toe

Of hernoem de huidige repo in GitHub Settings → General → Repository name.

## API

### `POST /api/scan`

```json
{
  "image": "<base64-encoded image>",
  "mimeType": "image/jpeg"
}
```

Response bevat gedetecteerde kaarten, matches, prijzen en `summary.totalMarketValue`.

### `GET /api/health`

Controleert of vision provider en Pokémon API geconfigureerd zijn.

## Architectuur

```
Next.js App Router
├── /                     → Upload UI + resultaten
├── /api/scan             → Vision AI + prijslookup
└── /api/health           → Config check

src/lib/
├── vision.ts             → Gemini / OpenAI bulk detectie
├── pokemon-tcg.ts        → Pokémon TCG API client
└── types.ts              → Gedeelde types
```

## Tips voor betere scans

- Leg kaarten plat naast elkaar
- Goede belichting, geen reflecties
- Zorg dat kaartnaam en nummer leesbaar zijn
- Max ~12 kaarten per foto (instelbaar via `MAX_CARDS_PER_SCAN`)

## Disclaimer

Prijzen zijn indicatief op basis van TCGPlayer marktdata. Werkelijke verkoopwaarde hangt af van conditie, grading en marktomstandigheden.

## Licentie

MIT
