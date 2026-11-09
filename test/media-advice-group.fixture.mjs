// Authored projected variants for unit/browser checks. Not live catalogue data,
// archived source responses or assertions about actual providers' offers.
import { syntheticHtml, SYNTHETIC_FILMS } from './kinobaza-html.fixture.mjs';
import { extractHtml } from '../netlify/lib/kinobaza-html.mjs';
import { assistedIdentity } from '../netlify/lib/kinobaza-card.mjs';

// Product-shaped selected metadata, separate from the retained demo's fixed-film
// gate. The catalogue above supplies only authored names; the runtime gate below
// must still establish title, year, canonical ownership and director evidence.
export function authoredProductFilm(id = 'coherence') {
  const selected = {
    coherence: { originalTitle: 'Coherence', year: 2013, imdbId: 'tt2866360', tmdbId: 220289 },
    'dune-part-two': { originalTitle: 'Dune: Part Two', year: 2024, imdbId: 'tt15239678', tmdbId: 693134 },
  }[id];
  if (!selected) throw new Error('Unknown authored product film.');
  const film = SYNTHETIC_FILMS[id];
  return { ...film, ...selected, identityTitle: selected.originalTitle,
    titleAliases: [selected.originalTitle], directorCount: 1, directorAliases: [film.director] };
}

export const authoredProductSourceURL = film => `https://kinobazaua.com/titles/${film.id}`;

export function authoredProductHTML(film, blocks = '', sourceURL = authoredProductSourceURL(film)) {
  // Reuse the shared authored provider scaffold without teaching the product gate
  // to accept its demo-only SYNTHETIC heading. Provider hrefs remain byte-exact.
  return syntheticHtml(film).replace('<h1>SYNTHETIC ', '<h1>')
    .replace('</head>', `<link rel="canonical" href="${sourceURL}"></head>`)
    .replace('<div id="availabilityAccordion">', `${blocks}<div id="availabilityAccordion">`);
}

export function extractProductHTML(html, film, sourceURL = authoredProductSourceURL(film)) {
  return extractHtml(html, film, { identityCheck: all => assistedIdentity(all, film, sourceURL) });
}

const unknown = () => ({ state: 'unknown' });
const reported = () => ({ state: 'reported', ukrainian: [{ language: 'ukr' }] });
const row = (id, key, extra = {}) => ({ id, identityStatus: 'matched', provider: { key }, country: 'UA',
  kind: 'source-offer', audio: unknown(), subtitles: unknown(), conflicts: [], comparisons: [],
  access: { state: 'reported', value: 'subscription' }, link: { href: null }, ...extra });

export function authoredGroupedMediaRows() {
  const sharedRakutenURL = 'https://rakuten.tv/ua/movies/authored-shared-card?source=AUTHOR%2fONLY';
  return [
    row('motn:prime-rent', 'prime', { audio: reported(), access: { state: 'reported', value: 'rental' },
      link: { href: 'https://www.primevideo.com/detail/AUTHOREDRENT' } }),
    row('motn:prime-buy', 'prime', { access: { state: 'reported', value: 'purchase' } }),
    row('motn:hbo-subtitles', 'hbo', { subtitles: reported() }),
    row('tmdb:hbo-availability', 'hbo'),
    row('motn:rakuten-rent', 'rakuten', { access: { state: 'reported', value: 'rental' }, link: { href: sharedRakutenURL },
      quality: { state: 'reported', value: 'hd' }, price: { state: 'reported', amount: { state: 'reported', value: '1.23' }, currency: { state: 'reported', value: 'XXX' } } }),
    row('tmdb:rakuten-buy', 'rakuten', { access: { state: 'reported', value: 'buy' }, link: { href: sharedRakutenURL } }),
    row('kinobaza:rakuten-block', 'rakuten', { kind: 'candidate-link', country: null,
      kinobazaLocalization: { audio: { state: 'reported-positive', evidence: [{ label: 'Укр. звук (dolby)', literal: '+', state: 'positive', formatLiteral: 'dolby' }] }, subtitles: { state: 'reported-positive' } },
      link: { href: 'https://rakuten.tv/ua/movies/authored-separate-block' } }),
    row('motn:rakuten-conflict', 'rakuten', { audio: { state: 'conflicting' }, subtitles: reported(),
      conflicts: [{ field: 'audio', type: 'authored-conflict' }], link: { href: 'https://rakuten.tv/ua/movies/authored-conflict' } }),
  ];
}

// Authored HTML through the actual extractor/projection, never a live response.
export async function authoredDuneMediaResult() {
  const { composeDiscovery } = await import('../netlify/lib/media-discovery-compose.mjs');
  const { tableBlock, paragraphBlock } = await import('./kinobaza-localization.fixture.mjs');
  // Same authored source case, now selected with complete product metadata;
  // it does not assert a current source response or expand the demo catalogue.
  const film = authoredProductFilm('dune-part-two');
  const sourceURLs = { kinobaza: 'https://kinobaza.com.ua/titles/dune-part-two',
    kinobazaLocalization: { source: 'Kinobaza HTML', method: 'authored synthetic source blocks',
      sourceURL: 'https://kinobaza.com.ua/titles/dune-part-two', receivedAt: undefined, upstream: 'not-established' } };
  const body = authoredProductHTML(film,
    tableBlock('itunes', [['Укр. звук (стерео)', '+'], ['Укр. субтитри', '−']], 'https://itunes.apple.com/ua/movie/id9999001?at=AUTHOR%2fONLY') +
    tableBlock('rakuten', [['Укр. звук', '+'], ['Укр. субтитри', '+']], 'https://rakuten.tv/ua/movies/authored-dune') +
    paragraphBlock('megogo', '(укр. аудіо, укр. субтитри)', 'https://megogo.net/ua/view/9999002-authored.html'));
  const extraction = await extractProductHTML(body, film);
  const result = composeDiscovery(film, { tmdb: { result: null }, motn: { result: null }, kinobaza: { result: extraction, status: extraction.status } }, { synthetic: true, sourceURLs });
  return { ...result, rows: result.rows.filter(row => row.kinobazaLocalization), unmapped: [], stages: undefined,
    metrics: { requestsMade: 0, requestBudget: 8, calls: [] } };
}
