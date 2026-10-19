// Copied ONLY into a temporary Windows test checkout as server.mjs. The real
// server/owner demo is never replaced. No global fetch: mock transport only.
import { createDemo } from './server-core.mjs';
import { syntheticMotn } from './motn.mjs';
import { networkConfig } from './network.mjs';
if (process.env.MOTN_API_KEY !== 'offline-motn-key-sentinel' || process.env.GEMINI_API_KEY !== undefined) {
  throw new Error('Offline child credential routing mismatch. No content disclosed.');
}
const networkOptions = { access: process.env.DEMO_ACCESS, bindIPv4: process.env.DEMO_BIND_IPV4, lanPassword: process.env.DEMO_LAN_PASSWORD };
const network = networkConfig(networkOptions);
const server = createDemo({ mode: process.env.DEMO_MODE, filmId: process.env.DEMO_FILM, discovery: process.env.DEMO_DISCOVERY,
  retrieval: process.env.DEMO_RETRIEVAL, motnKey: process.env.MOTN_API_KEY, ...networkOptions,
  fetchImpl: async (url, init) => {
    if (url !== 'https://api.movieofthenight.com/v4/shows/tt2866360?country=ua' || init.headers['X-API-Key'] !== 'offline-motn-key-sentinel') {
      throw new Error('Offline transport contract mismatch.');
    }
    return Response.json(syntheticMotn('coherence'));
  } });
server.listen(Number(process.env.DEMO_PORT), network.bindAddress);
