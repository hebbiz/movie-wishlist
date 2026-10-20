// Authored inputs only; no live response, provider result or owner control.
import { selectRequest } from '../config.mjs';
import { authoredDiscoveryData, runDiscovery } from '../discovery.mjs';
import { describeDiscovery } from '../matching.mjs';
import { localizedMarkup, tableBlock } from './kinobaza-localization.fixture.mjs';
export const MYKOLA_STATES = ['several', 'unbound-localization', 'conflicting-properties', 'candidates-only', 'partial-source'];
export async function mykolaFixture(kind) {
  if (!MYKOLA_STATES.includes(kind)) throw new Error('Authored state required');
  const selection = selectRequest({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: 'coherence' });
  const data = authoredDiscoveryData(selection.film), calls = [];
  const card = 'https://tv.apple.com/ua/movie/authored/umc.cmc.authoredmykola';
  data.motn.streamingOptions.ua = [{ ...data.motn.streamingOptions.ua[0], type: 'buy', link: card, audios: [], subtitles: [] }];
  if (kind === 'several' || kind === 'partial-source') {
    data.motn.streamingOptions.ua[0].service = { id: 'prime', name: 'Prime Video' };
    data.motn.streamingOptions.ua[0].type = 'rent';
    data.motn.streamingOptions.ua[0].link = 'https://www.primevideo.com/detail/AUTHOREDMYKOLA';
  }
  if (kind === 'unbound-localization') data.html = localizedMarkup(tableBlock('itunes', [['Укр. звук', '+'], ['Укр. субтитри', '-']],
    'https://itunes.apple.com/ua/movie/id999999?at=AUTHORED%2fTOKEN&amp;l=uk'));
  if (kind === 'conflicting-properties') {
    data.html = localizedMarkup(tableBlock('itunes', [['Укр. звук', '+'], ['Укр. звук', '-']], card));
    const first = data.motn.streamingOptions.ua[0];
    first.quality = 'hd'; first.price = { amount: '1.23', currency: 'UAH' };
    data.motn.streamingOptions.ua.push({ ...first, quality: 'uhd', price: { amount: '4.56', currency: 'USD' } });
  }
  if (kind === 'candidates-only') { data.tmdb.providers.results.UA = {}; data.motn.streamingOptions.ua = []; }
  // Remove unrelated deliberately unsupported examples from this UI fixture only.
  data.html = data.html.replaceAll('Example UA', 'Apple TV Store')
    .replace('https://example.com/redirect?x=%2F&amp;y=1', 'https://click.justwatch.com/authored?tracking=TOKEN%2fVALUE')
    .replace(/<a title="Дивитись \/ Купити на Example Outside"[^>]*>Example Outside<\/a>/, '');
  const result = await runDiscovery(selection, { mode: 'live', tmdbToken: 'authored-token-only', motnKey: 'authored-key-only', fetchImpl: async (url, init) => {
    calls.push(url); if (init.redirect !== 'manual') throw new Error('No automatic redirect');
    if (url.includes('themoviedb')) return kind === 'partial-source' ? new Response('AUTHORED_ERROR', { status: 503 })
      : Response.json(url.endsWith('/watch/providers') ? data.tmdb.providers : data.tmdb.details);
    if (url.includes('movieofthenight')) return Response.json(data.motn);
    if (url !== 'https://kinobaza.com.ua/titles/coherence') throw new Error('Unexpected destination');
    return new Response(data.html, { headers: { 'content-type': 'text/html' } });
  } });
  result.synthetic = true; // All calls above are in-memory mock invocations.
  result.matching = describeDiscovery(result);
  return { result, calls };
}
