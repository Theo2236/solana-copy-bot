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

1. Push naar GitHub
2. Importeer in Vercel
3. Voeg de environment variables toe
4. Deploy

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
