// Frozen committed implementations, authored inputs and intercepted transport.
// No real provider/search/DB request, key or captured user/source data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readMediaAdviceBaselineSources } from './media-advice-history.fixture.mjs';
import * as tmdb from '../netlify/lib/media-source-tmdb.mjs';
import * as motn from '../netlify/lib/media-source-motn.mjs';
import { fetchAssistedKinobaza } from '../netlify/lib/kinobaza-card.mjs';
import { composeDiscovery } from '../netlify/lib/media-discovery-compose.mjs';
import { discoverMedia } from '../netlify/lib/media-advice-service.mjs';
import { createKinobazaResolver } from '../netlify/lib/kinobaza-resolver.mjs';
import { markup, CARD } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';
import { detailsData, providersData, motnData, IDS } from '../research/grounded-answer-demo/test/film-workflow.fixture.mjs';

const root = new URL('../', import.meta.url), loaded = new Map();
const baselineSources = readMediaAdviceBaselineSources();
const parse5 = import.meta.resolve('parse5');
async function frozen(path) {
  // Original historical import paths stay intact in Git. Only loader URLs are
  // rebound; no implementation, assertion, response value or gate is patched.
  const source = baselineSources.get(path).replace(/from '([^']+)'/g, (whole, name) => name.startsWith('.')
    ? `from '${loaded.get(new URL(name, new URL(path, root)).href) ?? new URL(name, new URL(path, root)).href}'` : whole)
    .replaceAll("import('parse5')", `import('${parse5}')`);
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  loaded.set(new URL(path, root).href, url); return import(url);
}
await frozen('research/grounded-answer-demo/kinobaza-localization.mjs');
await frozen('research/grounded-answer-demo/html-source.mjs');
const oldTmdb = await frozen('research/grounded-answer-demo/tmdb.mjs');
const oldMotn = await frozen('research/grounded-answer-demo/motn.mjs');
const oldCard = await frozen('research/grounded-answer-demo/assisted-kinobaza.mjs');
const oldComposition = await frozen('research/grounded-answer-demo/discovery.mjs');
await frozen('netlify/lib/kinobaza-director-verifier.mjs');
const oldResolver = await frozen('netlify/lib/kinobaza-resolver.mjs');
const oldService = await frozen('netlify/lib/media-advice-service.mjs');

const stamp = '2026-01-01T00:00:00.000Z';
const film = { id: `imdb:tt${IDS[0]}`, imdbId: `tt${IDS[0]}`, tmdbId: IDS[0],
  title: 'Вигаданий фільм', identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2001,
  titleAliases: ['Вигаданий фільм', 'Authored original'], directorAliases: ['Authored director'], directorCount: 1,
  directorPeople: [{ namespace: 'tmdb:person', personId: 999999, names: ['Authored director'] }] };
const urls = { tmdb: 'https://api.themoviedb.org/3/movie/999900001/watch/providers',
  motn: 'https://api.movieofthenight.com/v4/shows/tt999900001?country=ua' };
const copy = value => structuredClone(value);
// Only locally generated observation/computation times are excluded. Identity,
// source text, order, exact URLs, claims, issue codes and request slots are exact.
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([name]) => !['receivedAt', 'elapsedMs'].includes(name)).map(([name, item]) => [name, stable(item)]));
  return value;
}

test('frozen develop TMDb projections: same values for valid, missing, malformed and conflicting data', () => {
  const expected = { tmdbId: IDS[0], imdbId: `tt${IDS[0]}` };
  const details = detailsData(IDS[0]), providers = providersData(IDS[0]);
  for (const value of [details, null, {}, { ...details, id: IDS[1] }, { ...details, imdb_id: `tt${IDS[1]}` },
    { ...details, credits: null }, { ...details, translations: { translations: 'invalid' } },
    { ...details, credits: { crew: [{ job: 'Director', id: 8, name: 'A' }, { job: 'Director', id: 9, name: 'B' }] } }]) {
    assert.deepEqual(tmdb.projectTmdbIdentityFor(copy(value), expected, stamp), oldTmdb.projectTmdbIdentityFor(copy(value), expected, stamp));
  }
  for (const value of [providers, null, {}, { ...providers, id: IDS[1] }, { id: IDS[0], results: { UA: null } },
    { id: IDS[0], results: { UA: { flatrate: [{ provider_id: 350, provider_name: 'Apple TV' }], rent: [] } } }]) {
    assert.deepEqual(tmdb.projectTmdbProvidersFor(copy(value), expected, stamp), oldTmdb.projectTmdbProvidersFor(copy(value), expected, stamp));
  }
});

test('frozen develop MOTN projection: separate subscription/Store, missing/negative evidence and stable-ID conflicts', () => {
  const expected = { ...film, tmdbId: String(film.tmdbId), title: film.originalTitle };
  const data = motnData(IDS[0]);
  for (const value of [data, null, {}, { ...data, imdbId: `tt${IDS[1]}` }, { ...data, showType: 'series' },
    { ...data, streamingOptions: { ua: null } }, { ...data, streamingOptions: { ua: [] } },
    { ...data, streamingOptions: { ua: [
      ...data.streamingOptions.ua,
      { service: { id: 'apple', name: 'Apple TV' }, type: 'subscription', link: 'https://tv.apple.com/ua/movie/other/umc.cmc.authored',
        audios: [{ language: 'ukr' }], subtitles: [{ locale: { language: 'ukr' } }] },
    ] } }]) assert.deepEqual(motn.normalizeMotnFor(copy(value), expected, stamp), oldMotn.normalizeMotnFor(copy(value), expected, stamp));
});

test('frozen develop bounded transports preserve requests, statuses and no retry', async () => {
  for (const status of [200, 301, 401, 403, 404, 429, 500]) {
    for (const [current, previous, key, target] of [
      [tmdb.readTmdbJson, oldTmdb.readTmdbJson, 'AUTHORED_TMDB', 'https://api.themoviedb.org/3/movie/999900001'],
      [(url, secret, send) => motn.fetchMotnFor({ ...film, tmdbId: String(film.tmdbId) }, secret, send),
        (url, secret, send) => oldMotn.fetchMotnFor({ ...film, tmdbId: String(film.tmdbId) }, secret, send), 'AUTHORED_MOTN', urls.motn],
    ]) {
      const run = async implementation => {
        const calls = []; const result = await implementation(target, key, async (url, init) => {
          calls.push({ url, method: init.method, redirect: init.redirect, credentials: init.credentials, headers: init.headers });
          return status === 200 ? Response.json(target.includes('themoviedb') ? detailsData(IDS[0]) : motnData(IDS[0])) : new Response('', { status });
        }); return { result: stable(result), calls };
      };
      assert.deepEqual(await run(current), await run(previous));
    }
  }
});

test('frozen develop assisted HTML: identity, localized rows, unsafe pointers, ambiguous or malformed structures', async () => {
  for (const html of [markup(), markup({ original: 'Other original' }), markup({ year: 2010 }),
    markup({ director: 'Other director' }), markup({ stable: '<tr><td>IMDb:</td><td>tt999900002</td></tr>' }),
    markup().replace('</h1>', '</h1><h1>Ambiguous</h1>'), markup({ url: 'https://kinobazaua.com/titles/other-card' }),
    markup().replace('href="https://tv.apple.com', 'href="javascript:alert(1)//'), '<html><h1>incomplete']) {
    const run = async fn => {
      const calls = []; const result = await fn(CARD, film, async (url, init) => {
        calls.push({ url, method: init.method, redirect: init.redirect, headers: init.headers });
        return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
      }); return { calls, result: stable(result) };
    };
    assert.deepEqual(await run(fetchAssistedKinobaza), await run(oldCard.fetchAssistedKinobaza));
  }
});

test('frozen develop composition preserves claims, conflicts, row order and exact link spellings', async () => {
  const kino = await fetchAssistedKinobaza(CARD, film, async () => new Response(markup(), { headers: { 'content-type': 'text/html' } }));
  const details = tmdb.projectTmdbIdentityFor(detailsData(IDS[0]), film, stamp);
  const providers = tmdb.projectTmdbProvidersFor(providersData(IDS[0]), film, stamp);
  const options = motn.normalizeMotnFor(motnData(IDS[0]), { ...film, tmdbId: String(film.tmdbId), title: film.originalTitle }, stamp);
  const stages = { tmdb: { status: 'ok', result: { identity: details, providers } }, motn: { status: 'ok', result: options }, kinobaza: { status: kino.status, result: kino } };
  for (const selected of [stages, { ...stages, tmdb: { status: 'failed', result: null } }, { ...stages, kinobaza: { status: 'unresolved', result: null } }]) {
    assert.deepEqual(composeDiscovery(film, copy(selected), { sourceURLs: urls }), oldComposition.composeDiscovery(film, copy(selected), { sourceURLs: urls }));
  }
});

test('frozen develop full service/resolver retains reservations, wire requests, cap paths and ordinary/diagnostic results', async () => {
  for (const sourceCap of [8, 10, 12, 14]) for (const diagnostics of [false, true]) {
    const run = async (service, resolverFactory) => {
      const reservations = [], wire = [];
      const result = await service({ imdbId: film.imdbId, tmdbToken: 'AUTHORED_TMDB', motnKey: 'AUTHORED_MOTN', sourceCap, diagnostics,
        reserve: async stage => reservations.push(stage), resolver: resolverFactory({ apiKey: 'AUTHORED_SEARCH' }),
        fetchImpl: async (url, init) => {
          wire.push({ url, method: init.method, redirect: init.redirect, credentials: init.credentials, headers: init.headers, body: init.body ?? null });
          if (url.startsWith('https://api.themoviedb.org/3/find/')) return Response.json({ movie_results: [{ id: IDS[0], title: film.title, original_title: film.originalTitle }] });
          if (url === urls.tmdb) return Response.json(providersData(IDS[0]));
          if (url.startsWith('https://api.themoviedb.org/3/movie/')) return Response.json(detailsData(IDS[0]));
          if (url === urls.motn) return Response.json(motnData(IDS[0]));
          if (url === 'https://api.tavily.com/search') return Response.json({ results: [{ url: CARD }], request_id: 'AUTHORED-REQUEST', query: 'Authored original' });
          if (url === CARD) return new Response(markup(), { headers: { 'content-type': 'text/html' } });
          throw Error('Unexpected authored transport target');
        } });
      assert.ok(wire.some(call => call.url === 'https://api.tavily.com/search'), 'the authored search transport actually ran');
      assert.ok(wire.some(call => call.url === CARD), 'the authored card was actually read');
      assert.ok(result.rows.some(row => row.id.startsWith('kinobaza:')), 'the confirmed card reached composed rows');
      return { result: stable(result), reservations, wire };
    };
    assert.deepEqual(await run(discoverMedia, createKinobazaResolver), await run(oldService.discoverMedia, oldResolver.createKinobazaResolver));
  }
});
