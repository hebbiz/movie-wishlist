// Authored API-shaped data. Never a real title/preflight/response archive.
export const IDS = [999900001, 999900002];
export const searchData = () => ({ results: IDS.map((id, i) => ({ id, title: 'Вигаданий фільм', original_title: 'Authored original', release_date: `${2001 + i * 8}-01-01` })) });
export const detailsData = id => ({ id, imdb_id: `tt${id}`, title: 'Вигаданий фільм', original_title: 'Authored original', release_date: `${id === IDS[0] ? 2001 : 2009}-01-01`,
  external_ids: { imdb_id: `tt${id}` }, alternative_titles: { titles: [{ title: 'Авторський alias', iso_3166_1: 'UA' }] },
  credits: { crew: [{ id: 999999, name: 'Authored director', job: 'Director' }] }, release_dates: { results: [] }, translations: { translations: [] } });
export const providersData = id => ({ id, results: { UA: { rent: [{ provider_id: 2, provider_name: 'Apple TV Store' }] }, GB: { buy: [{ provider_id: 8, provider_name: 'Netflix' }] } } });
export const motnData = id => ({ showType: 'movie', imdbId: `tt${id}`, tmdbId: `movie/${id}`, originalTitle: 'Authored original', directors: ['Authored director'], releaseYear: 2001,
  streamingOptions: { ua: [{ service: { id: 'apple', name: 'Apple TV' }, type: 'buy', link: 'https://tv.apple.com/ua/movie/authored/umc.cmc.authoronly?at=&at=REFERRAL%2fONLY', audios: [], subtitles: [], quality: 'hd', price: { amount: '7.99', currency: 'UAH' } }] } });
export function mockTransport({ mutate = () => {}, response } = {}) {
  const calls = [];
  const fetchImpl = async (target, init) => {
    const u = new URL(target); assertLocalBoundary(u, init); calls.push(target);
    const phase = u.pathname === '/3/search/movie' ? 'search' : u.pathname.endsWith('/watch/providers') ? 'providers' : u.hostname === 'api.movieofthenight.com' ? 'motn' : 'preview';
    const id = Number((/\/movie\/(\d+)/.exec(u.pathname) ?? /\/shows\/tt(\d+)/.exec(u.pathname))?.[1] ?? IDS[0]);
    const d = phase === 'search' ? searchData() : phase === 'preview' ? detailsData(id) : phase === 'providers' ? providersData(id) : motnData(id);
    mutate(d, phase, id);
    return response ? response(phase, d, target, init) : Response.json(d);
  };
  return { calls, fetchImpl };
}
function assertLocalBoundary(u, init) {
  if (init.method !== 'GET' || init.redirect !== 'manual' || init.credentials !== 'omit') throw Error('Unbounded authored request');
  if (u.origin === 'https://api.themoviedb.org') { if (init.headers.Authorization !== 'Bearer author-tmdb-key' || init.headers['X-API-Key']) throw Error('Wrong TMDb key routing'); }
  else if (u.origin === 'https://api.movieofthenight.com') { if (init.headers['X-API-Key'] !== 'author-motn-key' || init.headers.Authorization) throw Error('Wrong MOTN key routing'); }
  else throw Error('Unexpected source/destination');
}
