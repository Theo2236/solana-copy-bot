<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pokémon Kaart Bulk Scanner

AI bulk scanner: upload een foto met meerdere Pokémon kaarten → Vision AI herkent ze → Pokémon TCG API geeft prijzen.

## Env vars

- `GEMINI_API_KEY` of `OPENAI_API_KEY` (vision)
- `POKEMON_TCG_API_KEY` (prijsdata)
