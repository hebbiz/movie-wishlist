// Replaces server.mjs ONLY in the lifecycle test temporary copy. No global fetch.
import { createDemo } from './server-core.mjs';
import { syntheticTmdb } from './tmdb.mjs';
import { networkConfig } from './network.mjs';
const token = 'offline-tmdb-token-sentinel';
if (process.env.TMDB_READ_ACCESS_TOKEN !== token || process.env.GEMINI_API_KEY !== undefined || process.env.MOTN_API_KEY !== undefined) throw new Error('Offline token isolation failed.');
const networkOptions = { access: process.env.DEMO_ACCESS, bindIPv4: process.env.DEMO_BIND_IPV4, lanPassword: process.env.DEMO_LAN_PASSWORD };
const network = networkConfig(networkOptions); let calls = 0;
const server = createDemo({ mode: process.env.DEMO_MODE, filmId: process.env.DEMO_FILM, discovery: process.env.DEMO_DISCOVERY,
  retrieval: process.env.DEMO_RETRIEVAL, tmdbToken: process.env.TMDB_READ_ACCESS_TOKEN, ...networkOptions,
  fetchImpl: async (url, init) => {
    calls++;
    const expected = calls === 1 ? 'https://api.themoviedb.org/3/movie/220289?language=uk-UA&append_to_response=external_ids,alternative_titles,credits,release_dates,translations' : 'https://api.themoviedb.org/3/movie/220289/watch/providers';
    if (calls > 2 || url !== expected || init.headers.Authorization !== `Bearer ${token}`) throw new Error('Offline transport contract failed.');
    const data = syntheticTmdb('coherence'); return Response.json(calls === 1 ? data.details : data.providers);
  } });
server.listen(Number(process.env.DEMO_PORT), network.bindAddress);
