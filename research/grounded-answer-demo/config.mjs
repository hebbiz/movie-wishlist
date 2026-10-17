export const MODEL = 'gemini-3.8-flash';
export const MAX_OUTPUT_TOKENS = 4096;
export const PROMPT = `Help me find a physical edition of Dune: Part Two (2024), directed by Denis Villeneuve, using Google Search.
Prefer 4K UHD Blu-ray; if no suitable UHD edition is found, consider Blu-ray.
Look at HMV, Rarewaves, and Amazon US, UK, Germany and Italy. Treat all four Amazon regions equally; after finding one suitable available Amazon edition, you may stop looking at other Amazon regions.
Give me a natural-language answer with citations, identifying the specific edition, its availability and a direct product URL. Distinguish an actual available offer from a listing whose availability is unclear, sold out or preorder. Do not infer availability from a price alone.
Include price/currency, picture, audio languages/formats, subtitles, edition identifiers or disc region compatibility only when the cited sources support them for that exact edition and disc. State uncertainty instead of combining specifications from different editions. A store's year alone need not identify the film: consider the director and other identifying context.
Do not discuss shipping, delivery, delivery costs or delivery to Ukraine. Do not make purchases, sign in, bypass access restrictions, scrape sites, build a dataset or return structured data. This is a single answer for me to read, not a request for exhaustive collection.`;

export function requestBody() {
  return {
    contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingLevel: 'low' },
    },
  };
}
