// Mock-only Windows child, replaces server.mjs in a unique temporary copy.
import { createDemo } from './server-core.mjs';
import { authoredDiscoveryData } from './discovery.mjs';
import { FILMS } from './config.mjs';
import { networkConfig } from './network.mjs';
const tmdb = 'offline-discovery-tmdb', motn = 'offline-discovery-motn';
if (process.env.TMDB_READ_ACCESS_TOKEN !== tmdb || process.env.MOTN_API_KEY !== motn || process.env.GEMINI_API_KEY !== undefined) throw new Error('Mock multi-key isolation failed.');
const options = { access: process.env.DEMO_ACCESS, bindIPv4: process.env.DEMO_BIND_IPV4, lanPassword: process.env.DEMO_LAN_PASSWORD };
const network = networkConfig(options); const calls = new Set();
const server = createDemo({ mode: 'live', retrieval: 'ua-discovery', discovery: process.env.DEMO_DISCOVERY, filmId: process.env.DEMO_FILM,
  kinobaza: process.env.DEMO_KINOBAZA, tmdbToken: tmdb, motnKey: motn, ...options,
  fetchImpl: async (url, init) => {
    if (calls.has(url) || calls.size >= 8) throw new Error('Mock budget exceeded.'); calls.add(url);
    const film = /220289|tt2866360|\/coherence$/.test(url) ? FILMS.coherence : FILMS['dune-part-two'];
    const data = authoredDiscoveryData(film);
    if (url.includes('themoviedb')) {
      if (init.headers.Authorization !== `Bearer ${tmdb}` || init.headers['X-API-Key']) throw new Error('Mock TMDb routing failed.');
      return Response.json(url.endsWith('/watch/providers') ? data.tmdb.providers : data.tmdb.details);
    }
    if (url.includes('movieofthenight')) {
      if (init.headers['X-API-Key'] !== motn || init.headers.Authorization) throw new Error('Mock MOTN routing failed.');
      return Response.json(data.motn);
    }
    if (url.includes('kinobaza.com.ua/titles/') && !init.headers.Authorization && !init.headers['X-API-Key']) return new Response(data.html, { headers: { 'content-type': 'text/html' } });
    throw new Error('Unexpected mock request; no global fetch.');
  } });
server.listen(Number(process.env.DEMO_PORT), network.bindAddress);
