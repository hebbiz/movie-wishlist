export const MODEL = 'gemini-3.8-flash';
export const MAX_OUTPUT_TOKENS = 4096;
const COMMON_INSTRUCTIONS = `Prefer 4K UHD Blu-ray; if no suitable UHD edition is found, consider Blu-ray.
Look at HMV, Rarewaves, and Amazon US, UK, Germany and Italy. Treat all four Amazon regions equally; after finding one suitable available Amazon edition, you may stop looking at other Amazon regions.
Give me a natural-language answer with citations, identifying the specific edition, its availability and a direct product URL. Distinguish an actual available offer from a listing whose availability is unclear, sold out or preorder. Do not infer availability from a price alone.
Include price/currency, picture, audio languages/formats, subtitles, edition identifiers or disc region compatibility only when the cited sources support them for that exact edition and disc. State uncertainty instead of combining specifications from different editions. A store's year alone need not identify the film: consider the director and other identifying context.
Do not discuss shipping, delivery, delivery costs or delivery to Ukraine. Do not make purchases, sign in, bypass access restrictions, scrape sites, build a dataset or return structured data. This is a single answer for me to read, not a request for exhaustive collection.`;

// Preserve the original Dune prompt exactly, not just its intent.
export const PROMPT = `Help me find a physical edition of Dune: Part Two (2024), directed by Denis Villeneuve, using Google Search.
${COMMON_INSTRUCTIONS}`;
export const DEFAULT_FILM = 'dune-part-two';
export const FILMS = Object.freeze({
  'dune-part-two': Object.freeze({
    id: 'dune-part-two', title: 'Dune: Part Two (2024)', director: 'Denis Villeneuve', prompt: PROMPT,
  }),
  coherence: Object.freeze({
    id: 'coherence', title: 'Coherence (2013)', director: 'James Ward Byrkit',
    prompt: `Help me find a physical edition of Coherence (2013), directed by James Ward Byrkit, using Google Search.
${COMMON_INSTRUCTIONS}
Distinguish the film's original release year (2013) from the physical edition's publication or reissue year; a different edition year alone does not mean a different film. Do not assume that a 4K UHD edition exists: if you cannot find a suitable UHD edition, say so without treating that as proof none exists, and consider Blu-ray.`,
  }),
  'blade-runner-final-cut': Object.freeze({
    id: 'blade-runner-final-cut', title: 'Blade Runner (1982) — The Final Cut', director: 'Ridley Scott',
    prompt: `Help me find a physical edition of Blade Runner (1982), directed by Ridley Scott, specifically The Final Cut, using Google Search.
${COMMON_INSTRUCTIONS}
The target is The Final Cut of the 1982 film, not a theatrical cut, Director's Cut, another version or Blade Runner 2049. Do not substitute these for the requested version. For a collection or multi-version set, establish that The Final Cut is included and identify its disc when the source allows. If the source does not confirm the cut, explicitly state that the version is uncertain rather than presenting it as a confirmed Final Cut offer. Distinguish the film's original year from the later cut or edition year.`,
  }),
});

export function selectFilm(id = DEFAULT_FILM) {
  if (!Object.hasOwn(FILMS, id)) throw new Error(`Unknown DEMO_FILM. Choose: ${Object.keys(FILMS).join(', ')}.`);
  return FILMS[id];
}

export function requestBody(filmId = DEFAULT_FILM) {
  const film = selectFilm(filmId);
  return {
    contents: [{ role: 'user', parts: [{ text: film.prompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingLevel: 'low' },
    },
  };
}
