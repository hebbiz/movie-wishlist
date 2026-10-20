// Mock-only Windows child, replaces server.mjs in a unique temporary copy.
import { createDemo } from './server-core.mjs';
import { authoredDiscoveryData } from './discovery.mjs';
import { FILMS } from './config.mjs';
import { HELD_OUT_FILMS } from './held-out.mjs';
import { MOTN_FILMS } from './motn.mjs';
import { networkConfig } from './network.mjs';
import { searchData, detailsData, providersData, motnData } from './film-probe.fixture.mjs';
const tmdb = 'offline-discovery-tmdb', motn = 'offline-discovery-motn';
if (process.env.TMDB_READ_ACCESS_TOKEN !== tmdb || process.env.MOTN_API_KEY !== motn || process.env.GEMINI_API_KEY !== undefined) throw new Error('Mock multi-key isolation failed.');
const options = { access: process.env.DEMO_ACCESS, bindIPv4: process.env.DEMO_BIND_IPV4, lanPassword: process.env.DEMO_LAN_PASSWORD };
const network = networkConfig(options); const calls = new Set();
const server = createDemo({ mode: 'live', retrieval: 'ua-discovery', discovery: process.env.DEMO_DISCOVERY, filmId: process.env.DEMO_FILM,
  kinobaza: process.env.DEMO_KINOBAZA, tmdbToken: tmdb, motnKey: motn, ...options,
  fetchImpl: async (url, init) => {
    if (calls.has(url) || calls.size >= 26) throw new Error('Mock budget exceeded.'); calls.add(url);
    const parsed = new URL(url);
    if (parsed.pathname === '/3/search/movie' || /99990000[12]/.test(parsed.pathname)) {
      if (url.includes('themoviedb') && (init.headers.Authorization !== `Bearer ${tmdb}` || init.headers['X-API-Key'])) throw new Error('Dynamic TMDb key routing');
      if (url.includes('movieofthenight') && (init.headers['X-API-Key'] !== motn || init.headers.Authorization)) throw new Error('Dynamic MOTN key routing');
      const id = Number(/(99990000[12])/.exec(parsed.pathname)?.[1]);
      return Response.json(parsed.pathname === '/3/search/movie' ? searchData() : parsed.pathname.endsWith('/watch/providers') ? providersData(id) : url.includes('movieofthenight') ? motnData(id) : detailsData(id));
    }
    const id = Object.keys(MOTN_FILMS).find(id => {
      const f = MOTN_FILMS[id];
      return url === `https://api.movieofthenight.com/v4/shows/${f.imdbId}?country=ua` ||
        url.startsWith(`https://api.themoviedb.org/3/movie/${f.tmdbId}?`) ||
        url === `https://api.themoviedb.org/3/movie/${f.tmdbId}/watch/providers` ||
        url === HELD_OUT_FILMS[id]?.kinobazaURL || url === `https://kinobaza.com.ua/titles/${id}`;
    });
    if (!id) throw new Error('Unconfigured mock source');
    const film = HELD_OUT_FILMS[id] ?? FILMS[id];
    const data = authoredDiscoveryData(film);
    if (url.includes('themoviedb')) {
      if (init.headers.Authorization !== `Bearer ${tmdb}` || init.headers['X-API-Key']) throw new Error('Mock TMDb routing failed.');
      return Response.json(url.endsWith('/watch/providers') ? data.tmdb.providers : data.tmdb.details);
    }
    if (url.includes('movieofthenight')) {
      if (init.headers['X-API-Key'] !== motn || init.headers.Authorization) throw new Error('Mock MOTN routing failed.');
      return Response.json(data.motn);
    }
    if (url.includes('kinobaza') && !init.headers.Authorization && !init.headers['X-API-Key']) return new Response(data.html, { headers: { 'content-type': 'text/html' } });
    throw new Error('Unexpected mock request; no global fetch.');
  } });
server.listen(Number(process.env.DEMO_PORT), network.bindAddress);
