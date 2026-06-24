import { z } from "zod";
import type { CardCondition, DetectedCard } from "./types";

const detectedCardSchema = z.object({
  name: z.string().min(1),
  setName: z.string().optional(),
  cardNumber: z.string().optional(),
  rarity: z.string().optional(),
  condition: z
    .enum([
      "mint",
      "near_mint",
      "lightly_played",
      "moderately_played",
      "heavily_played",
      "damaged",
      "unknown",
    ])
    .default("unknown"),
  confidence: z.number().min(0).max(1).default(0.5),
  notes: z.string().optional(),
});

const visionResponseSchema = z.object({
  cards: z.array(detectedCardSchema),
});

const VISION_PROMPT = `Je bent een expert in Pokémon TCG kaarten. Analyseer de foto en identificeer ELKE zichtbare Pokémon kaart.

Regels:
- Geef alle kaarten terug die je ziet, ook als ze deels overlappen.
- Lees de kaartnaam, setnaam (indien zichtbaar), kaartnummer (bijv. 025/198), en rarity.
- Schat de conditie in op basis van zichtbare slijtage.
- confidence is 0-1 (hoe zeker je bent over de identificatie).
- Als tekst onleesbaar is, geef je beste gok en lage confidence.
- Antwoord ALLEEN met geldig JSON in dit formaat:
{
  "cards": [
    {
      "name": "Pikachu",
      "setName": "151",
      "cardNumber": "025/165",
      "rarity": "Common",
      "condition": "near_mint",
      "confidence": 0.92,
      "notes": "optioneel"
    }
  ]
}`;

function parseVisionJson(raw: string): DetectedCard[] {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = visionResponseSchema.parse(JSON.parse(cleaned));

  return parsed.cards.map((card, index) => ({
    index: index + 1,
    name: card.name.trim(),
    setName: card.setName?.trim(),
    cardNumber: card.cardNumber?.trim(),
    rarity: card.rarity?.trim(),
    condition: card.condition as CardCondition,
    confidence: card.confidence,
    notes: card.notes?.trim(),
  }));
}

async function analyzeWithGemini(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
  maxCards: number,
): Promise<DetectedCard[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${VISION_PROMPT}\n\nMaximaal ${maxCards} kaarten.` },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API fout (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini gaf geen resultaat terug");

  return parseVisionJson(text).slice(0, maxCards);
}

async function analyzeWithOpenAI(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
  maxCards: number,
): Promise<DetectedCard[]> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `${VISION_PROMPT}\n\nMaximaal ${maxCards} kaarten.` },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API fout (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI gaf geen resultaat terug");

  return parseVisionJson(text).slice(0, maxCards);
}

export async function analyzeBulkPhoto(options: {
  imageBase64: string;
  mimeType: string;
  geminiKey?: string;
  openaiKey?: string;
  maxCards: number;
}): Promise<{ cards: DetectedCard[]; provider: "gemini" | "openai" }> {
  const { imageBase64, mimeType, geminiKey, openaiKey, maxCards } = options;

  if (geminiKey) {
    const cards = await analyzeWithGemini(imageBase64, mimeType, geminiKey, maxCards);
    return { cards, provider: "gemini" };
  }

  if (openaiKey) {
    const cards = await analyzeWithOpenAI(imageBase64, mimeType, openaiKey, maxCards);
    return { cards, provider: "openai" };
  }

  throw new Error("Geen vision provider geconfigureerd (GEMINI_API_KEY of OPENAI_API_KEY)");
}
