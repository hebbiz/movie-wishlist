// Public regional card identities checked against official Apple pages 2026-10-18.
// No expected offer/localization/video facts belong in this catalogue or prompt.
export const APPLE_UA_CARDS = Object.freeze({
  'dune-part-two': 'https://tv.apple.com/ua/movie/dune-part-two/umc.cmc.363aycnv6vy9qgekvew6fveb9',
  coherence: 'https://tv.apple.com/ua/movie/coherence/umc.cmc.hdoayzcx3u9ofxfawjrt3hgc',
});

export function urlScenario(film, { discovery, amazonRegion } = {}) {
  if (discovery !== 'digital-ua') throw new Error('URL Context requires DEMO_DISCOVERY=digital-ua. No fallback to Search.');
  if (amazonRegion !== undefined) throw new Error('Unset DEMO_AMAZON_REGION for URL Context.');
  if (!Object.hasOwn(APPLE_UA_CARDS, film.id)) throw new Error('URL Context supports only dune-part-two and coherence. No fallback to Search.');
  const sourceURL = APPLE_UA_CARDS[film.id];
  const prompt = `Read only this specific public Apple TV Ukraine card using URL Context: ${sourceURL}
The target film is ${film.title}, directed by ${film.director}. Check identity against title, director, cast and synopsis; distinguish the original film year from a regional release or reissue year. If identity cannot be established, say unknown.
Give me a natural-language answer, not structured data or a dataset. Refer to this exact card, preserving any source attribution. Do not use Google Search, other pages, prior knowledge as page evidence, or nested links. Do not sign in, use account cookies, bypass restrictions, scrape sites or make a purchase.
Describe separately what the public page supports about:
1. Film identity.
2. Viewing availability in Ukraine. A Ukrainian URL or interface alone does not prove entitlement. State the limits of public metadata; do not demand or invent evidence visible only in an account. Account playback does not establish a new rental or purchase.
3. Ukrainian audio, including a track's audio format only if shown. Original language is not available audio.
4. Ukrainian subtitles, separately from audio, including subtitle types only if shown.
5. Video: 4K, HDR10, Dolby Vision and HD, each separately. Do not infer one from another or from a typical distribution format.
6. Rental, purchase or subscription, and price/currency only if shown for this card. Metadata is not an account's entitlement.
For every aspect distinguish supported presence, explicit absence and unknown. Missing metadata is unknown, not absence. Do not transfer global or foreign-card properties or supply typical characteristics. If retrieval fails, make that limitation explicit rather than answering as if the page was read. Retrieval success alone does not prove truth, freshness or Ukrainian account access.`;
  return Object.freeze({ film, discovery, amazonRegion: null, retrieval: 'url-context', sourceURL, prompt });
}
