// Replaces server.mjs ONLY in a lifecycle test temporary copy. No global fetch.
import { createDemo } from './server-core.mjs';
import { syntheticMegogo } from './megogo-synthetic.mjs';
import { MEGOGO_URL } from './megogo.mjs';
import { networkConfig } from './network.mjs';
if (['GEMINI_API_KEY', 'MOTN_API_KEY', 'TMDB_READ_ACCESS_TOKEN'].some(k => process.env[k] !== undefined)) throw new Error('HTML child received an API credential.');
const networkOptions = { access: process.env.DEMO_ACCESS, bindIPv4: process.env.DEMO_BIND_IPV4, lanPassword: process.env.DEMO_LAN_PASSWORD };
const network = networkConfig(networkOptions); let calls = 0;
const server = createDemo({ mode: process.env.DEMO_MODE, filmId: process.env.DEMO_FILM, discovery: process.env.DEMO_DISCOVERY, retrieval: process.env.DEMO_RETRIEVAL, ...networkOptions,
  fetchImpl: async (url, init) => {
    if (++calls !== 1 || url !== MEGOGO_URL || init.method !== 'GET' || init.redirect !== 'manual' || init.headers.Authorization) throw new Error('Offline one-GET contract failed.');
    return new Response(syntheticMegogo(), { headers: { 'content-type': 'text/html' } });
  } });
server.listen(Number(process.env.DEMO_PORT), network.bindAddress);
