// Entirely authored, not preflight IDs or source responses. Never fetched.
const htmlText = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
export const authoredAssistedHtml = (film, url) => `<!doctype html><html><head><link rel="canonical" href="${htmlText(url)}"></head><body><h1>${htmlText(film.identityTitle)} (${film.year})</h1><h2>${htmlText(film.originalTitle)}</h2><table><tr><td>Режисер:</td><td>${htmlText(film.directorAliases[0])}</td></tr></table><p>ВИГАДАНИЙ приклад, не прочитана картка.</p><div id="availabilityAccordion"><div class="accordion-item"><h2 class="accordion-header"><button data-bs-target="#collapseUA">Доступно в Україні</button></h2><div id="collapseUA" data-bs-parent="#availabilityAccordion"><a title="Дивитись / Купити на Apple TV Store" href="https://tv.apple.com/ua/movie/synthetic/umc.cmc.syntheticonly">ВИГАДАНЕ посилання</a></div></div></div></body></html>`;
export const authoredFilmSearch = () => ({ results: [999900001, 999900002].map((id, i) => ({ id,
  title: 'ВИГАДАНИЙ фільм', original_title: 'SYNTHETIC invented title', release_date: `${2001 + i * 8}-01-01` })) });
export const authoredFilmDetails = id => ({ id, imdb_id: `tt${id}`, title: 'ВИГАДАНИЙ фільм', original_title: 'SYNTHETIC invented title',
  release_date: `${id === 999900001 ? 2001 : 2009}-01-01`, external_ids: { imdb_id: `tt${id}` },
  alternative_titles: { titles: [] }, credits: { crew: [{ id: 999999999, job: 'Director', name: 'SYNTHETIC director' }] },
  translations: { translations: [] }, release_dates: { results: [] } });
export const authoredFilmProviders = id => ({ id, results: { UA: { rent: [{ provider_id: 2, provider_name: 'Apple TV Store' }] } } });
export const authoredFilmMotn = expected => ({ source: 'Movie of the Night', status: 'ok', receivedAt: new Date().toISOString(),
  identity: { status: 'matched', imdbId: { state: 'reported', value: expected.imdbId }, tmdbId: { state: 'reported', value: expected.tmdbId } },
  options: [{ service: { id: { state: 'reported', value: 'apple' }, name: { state: 'reported', value: 'Apple TV Store' } },
    access: { state: 'reported', value: 'buy' }, addon: {}, link: { state: 'reported', value: 'https://tv.apple.com/ua/movie/synthetic/umc.cmc.syntheticonly?at=AUTHORONLY' },
    quality: { state: 'not-reported' }, price: { state: 'not-reported' }, ukrainianAudio: { state: 'not-reported' }, ukrainianSubtitles: { state: 'not-reported' } }] });
