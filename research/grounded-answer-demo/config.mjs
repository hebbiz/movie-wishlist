import { urlScenario } from './url-context.mjs';
import { htmlScenario } from './html-source.mjs';
import { motnScenario } from './motn.mjs';
import { tmdbScenario } from './tmdb.mjs';
import { megogoScenario } from './megogo.mjs';
import { discoveryScenario } from './discovery.mjs';
import { HELD_OUT_FILMS, isHeldOut } from './held-out.mjs';

export const MODEL = 'gemini-3.8-flash';
export const MAX_OUTPUT_TOKENS = 4096;
export const DEFAULT_FILM = 'dune-part-two';
export const AMAZON_REGIONS = Object.freeze({
  us: 'amazon.com', uk: 'amazon.co.uk', de: 'amazon.de', it: 'amazon.it',
});
export const FILMS = Object.freeze({
  'dune-part-two': Object.freeze({ id: 'dune-part-two', title: 'Dune: Part Two (2024)', director: 'Denis Villeneuve' }),
  coherence: Object.freeze({ id: 'coherence', title: 'Coherence (2013)', director: 'James Ward Byrkit' }),
  'blade-runner-final-cut': Object.freeze({ id: 'blade-runner-final-cut', title: 'Blade Runner (1982) — The Final Cut', director: 'Ridley Scott' }),
});

export function selectFilm(id = DEFAULT_FILM) {
  if (!Object.hasOwn(FILMS, id)) throw new Error(`Unknown DEMO_FILM. Choose: ${Object.keys(FILMS).join(', ')}.`);
  return FILMS[id];
}

const SAFETY = `Give me a natural-language answer with citations, not structured data. Include direct offer links and make uncertainty explicit. Check that each citation refers to the exact film, cut, edition and offer being described; a citation is attribution, not proof of truth. Do not transfer characteristics between offers or discs without evidence of identity.
Do not discuss shipping, delivery, delivery costs or delivery to Ukraine. Do not make purchases, sign in, bypass access restrictions, scrape sites or build a dataset. This is a single answer for me to read, not a request for exhaustive collection.`;
const PHYSICAL = `Search and present in this priority order: availability, then English audio, then 4K UHD Blu-ray / Blu-ray / DVD, then other details. Do not assume that a UHD edition exists; if no suitable UHD edition is found, consider Blu-ray, then DVD. A failure to find an edition is not proof none exists.
Identify the specific physical edition, availability and direct product URL. Distinguish an available offer, preorder, sold out/unavailable and unknown stock status. Do not infer availability from a price alone. A sold-out price is not a successful available offer and must not be called historical without evidence.
Amazon Marketplace offers are allowed, not only Amazon-direct or Amazon-fulfilled listings. State seller and condition if known; otherwise say unknown. Do not assume Amazon is the seller.
Include price/currency, picture, audio languages/formats, subtitles, edition identifiers or disc region compatibility only when sources support them for that exact edition and disc. Distinguish UHD disc characteristics from the bundled Blu-ray. English as the film's original language does not prove an English track on a particular disc. State whether each relevant detail is confirmed present, confirmed absent or unknown, using appropriate source evidence rather than inference. A store's year alone need not identify the film: distinguish film year from edition publication or reissue year and use the director and other identifying context.`;
const DIGITAL_UA = `Find legal digital viewing offers in Ukraine on Apple TV, Rakuten TV, Netflix, Prime Video, MEGOGO and HBO Max (formerly Max). The brand name alone does not establish service or title availability in Ukraine. Do not substitute a foreign-market offer.
Search and present in this exact priority order:
1. Ability to watch the film in Ukraine.
2. Ukrainian audio track.
3. Ukrainian subtitles, separately from audio.
4. Video format: 4K, HDR10, Dolby Vision, HD, each separately.
5. Access type (subscription, rental or purchase), price/currency and other parameters, when confirmed for the Ukrainian offer; include a direct offer URL when confirmed.
For each characteristic distinguish confirmed presence, confirmed absence and unknown. Explicit Ukrainian entitlement or viewing evidence is needed: a title page, Ukrainian interface language or a country-code URL alone does not confirm playback in Ukraine. A negative search result is not proof of unavailability in Ukraine. If territory or viewing entitlement cannot be established, keep availability unknown.
Do not transfer global or foreign-market specifications to a Ukrainian offer. Check audio and subtitles separately for the specific Ukrainian offer; do not substitute subtitles for audio. 4K does not prove HDR10 or Dolby Vision, and neither HDR format proves 4K. Do not infer an audio track from the film's original language, or Ukrainian Atmos from a generic Atmos badge. Keep absent evidence unknown rather than claiming absence.
Among offers with established Ukrainian viewing availability, prefer HD with Ukrainian audio over 4K without Ukrainian localization. If Ukrainian audio is absent, prefer Ukrainian subtitles over a better video format without localization. Do not let video quality outrank Ukrainian audio or subtitles. Describe unresolved localization as unknown rather than treating it as confirmed absent. Do not research physical discs in this mode.`;
const FINAL_CUT = `The target is The Final Cut of the 1982 film, not a theatrical cut, Director's Cut, another version or Blade Runner 2049. Do not substitute these for the requested version. For a collection or multi-version set, establish that The Final Cut is included and identify its disc or digital version when the source allows. If the source does not confirm the cut, explicitly state that the version is uncertain rather than presenting it as a confirmed Final Cut offer. Distinguish the film's original year from the later cut or edition year.`;

// Only validated server configuration reaches this builder. No browser input.
export function selectScenario({ filmId, discovery = 'physical', amazonRegion } = {}) {
  const film = selectFilm(filmId);
  if (!['physical', 'digital-ua'].includes(discovery)) throw new Error('Unknown DEMO_DISCOVERY. Choose: physical, digital-ua.');
  if (amazonRegion !== undefined && !Object.hasOwn(AMAZON_REGIONS, amazonRegion)) throw new Error('Unknown DEMO_AMAZON_REGION. Choose: us, uk, de, it, or unset it.');
  if (discovery === 'digital-ua' && amazonRegion !== undefined) throw new Error('DEMO_AMAZON_REGION is only allowed with DEMO_DISCOVERY=physical; unset it for digital-ua.');
  const scope = amazonRegion === undefined
    ? 'Look at HMV, Rarewaves, and Amazon US, UK, Germany and Italy. Treat all four Amazon regions equally; after finding one suitable available Amazon edition, you may stop looking at other Amazon regions.'
    : `Search only the Amazon store ${AMAZON_REGIONS[amazonRegion]} for physical editions, including Marketplace offers. Do not search other Amazon regions, HMV, Rarewaves or other retailers in this isolated region test.`;
  const prompt = [
    `Help me find ${discovery === 'physical' ? 'a physical edition' : 'digital viewing availability in Ukraine'} of ${film.title}, directed by ${film.director}, using Google Search.`,
    discovery === 'physical' ? scope : DIGITAL_UA,
    discovery === 'physical' ? PHYSICAL : null,
    film.id === 'coherence' ? "Identify Coherence (2013), directed by James Ward Byrkit. Distinguish the film's original release year from the offer's edition publication or reissue year." : null,
    film.id === 'blade-runner-final-cut' ? FINAL_CUT : null,
    SAFETY,
  ].filter(Boolean).join('\n');
  return Object.freeze({ film, discovery, amazonRegion: amazonRegion ?? null, prompt });
}

export const PROMPT = selectScenario().prompt;

export function selectRequest({ retrieval = 'search', ...options } = {}) {
  if (retrieval !== 'ua-discovery' && options.kinobaza !== undefined) throw new Error('DEMO_KINOBAZA is only supported in ua-discovery; unset it for existing modes.');
  if (retrieval === 'ua-discovery') return discoveryScenario(isHeldOut(options.filmId) ? HELD_OUT_FILMS[options.filmId] : selectFilm(options.filmId), options);
  if (retrieval === 'search') {
    if (options.urlSource !== undefined) throw new Error('DEMO_URL_SOURCE requires DEMO_RETRIEVAL=url-context; unset it for Search.');
    return { ...selectScenario(options), retrieval, sourceURL: null };
  }
  if (retrieval === 'url-context') return urlScenario(selectFilm(options.filmId), options);
  if (retrieval === 'kinobaza-html') return htmlScenario(selectFilm(options.filmId), options);
  if (retrieval === 'motn-api') return motnScenario(selectFilm(options.filmId), options);
  if (retrieval === 'tmdb-data') return tmdbScenario(selectFilm(options.filmId), options);
  if (retrieval === 'megogo-html') return megogoScenario(selectFilm(options.filmId), options);
  throw new Error('Unknown DEMO_RETRIEVAL. Choose: search, url-context, kinobaza-html, motn-api, tmdb-data, megogo-html, ua-discovery.');
}

export function requestBody(filmId = DEFAULT_FILM, options = {}) {
  const { prompt, retrieval } = selectRequest({ ...options, filmId });
  if (retrieval === 'ua-discovery') throw new Error('UA discovery has no Gemini request body.');
  if (retrieval === 'kinobaza-html') throw new Error('HTML mode has no Gemini request body.');
  if (retrieval === 'motn-api') throw new Error('Movie of the Night mode has no Gemini request body.');
  if (retrieval === 'tmdb-data') throw new Error('TMDb mode has no Gemini request body.');
  if (retrieval === 'megogo-html') throw new Error('MEGOGO HTML mode has no Gemini request body.');
  return {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: retrieval === 'url-context' ? [{ urlContext: {} }] : [{ googleSearch: {} }],
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingLevel: 'low' },
    },
  };
}
