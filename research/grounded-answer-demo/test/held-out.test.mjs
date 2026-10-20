// Authored responses only: no source/destination/API calls or real offer facts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemo } from '../server.mjs';
import { selectRequest } from '../config.mjs';
import { HELD_OUT_FILMS } from '../held-out.mjs';
import { TMDB_FILMS, projectTmdbIdentity } from '../tmdb.mjs';
import { MOTN_FILMS, normalizeMotn } from '../motn.mjs';
import { htmlScenario, extractHtml, canonicalRedirectTarget } from '../html-source.mjs';
import { authoredDiscoveryData, runDiscovery, DISCOVERY_IDS } from '../discovery.mjs';
import { describeDiscovery } from '../matching.mjs';
import { prepareDraft } from '../public/discovery-client.mjs';
import { buildShortReport } from '../public/discovery-report.mjs';

export const heldIds = Object.keys(HELD_OUT_FILMS);
export const choose = filmId => selectRequest({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId });
export function heldMock(calls, { mutate = () => {}, redirect = false } = {}) {
  return async (url, init) => {
    const film = Object.values(HELD_OUT_FILMS).find(f => url === f.kinobazaURL ||
      url === `https://api.movieofthenight.com/v4/shows/${f.imdbId}?country=ua` ||
      url === `https://api.themoviedb.org/3/movie/${f.tmdbId}/watch/providers` ||
      url === `https://api.themoviedb.org/3/movie/${f.tmdbId}?language=uk-UA&append_to_response=external_ids,alternative_titles,credits,release_dates,translations`);
    assert.ok(film, 'No unplanned/destination request'); calls.push({ url, init });
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    const data = authoredDiscoveryData(film); mutate(data, film);
    if (url.includes('themoviedb')) return Response.json(url.endsWith('/watch/providers') ? data.tmdb.providers : data.tmdb.details);
    if (url.includes('movieofthenight')) return Response.json(data.motn);
    assert.equal(init.headers.Authorization, undefined); assert.equal(init.headers['X-API-Key'], undefined);
    if (redirect) return new Response(null, { status: 301, headers: { location: 'https://private.invalid/do-not-follow' } });
    return new Response(data.html, { headers: { 'content-type': 'text/html' } });
  };
}
const mockRun = (id, calls = [], options = {}) => runDiscovery(choose(id), {
  mode: 'live', tmdbToken: 'held-offline-token', motnKey: 'held-offline-key', fetchImpl: heldMock(calls, options),
});

test('held-out fixed catalogue: distinct Thing IDs; new films cannot widen Search/URL Context modes', () => {
  assert.equal(DISCOVERY_IDS.length, 6);
  assert.equal(HELD_OUT_FILMS.parasite.originalTitle, '기생충');
  assert.deepEqual(heldIds.map(id => [TMDB_FILMS[id].tmdbId, MOTN_FILMS[id].imdbId]),
    [[1495, 'tt0320661'], [1091, 'tt0084787'], [60935, 'tt0905372'], [496243, 'tt6751668']]);
  for (const id of heldIds) {
    for (const retrieval of ['search', 'url-context', 'motn-api', 'tmdb-data', 'megogo-html']) {
      assert.throws(() => selectRequest({ filmId: id, retrieval, discovery: 'digital-ua' }), /Unknown DEMO_FILM/);
    }
    const s = choose(id);
    assert.equal(s.kinobaza, HELD_OUT_FILMS[id].kinobazaURL ? 'on' : 'off');
    assert.equal(s.requestBudget, s.kinobaza === 'on' ? 4 : 3);
    assert.equal(s.baseRequestBudget, s.requestBudget); assert.equal(s.canonicalHop, false);
  }
  for (const id of ['the-thing-1982', 'the-thing-2011']) assert.throws(() => htmlScenario(HELD_OUT_FILMS[id], { discovery: 'digital-ua' }));
});

test('four independent mocked discoveries use exactly14 fixed GETs; no hidden hop/fallback', async () => {
  const calls = [];
  for (const id of heldIds) {
    const begin = calls.length, r = await mockRun(id, calls);
    assert.equal(calls.length - begin, choose(id).requestBudget);
    assert.equal(r.metrics.requestsMade, choose(id).requestBudget);
    assert.equal(r.sources[0].identity, 'matched'); assert.equal(r.sources[1].identity, 'matched');
    const cardCalls = calls.slice(begin).filter(c => c.url.includes('kinobaza'));
    assert.equal(cardCalls.length, HELD_OUT_FILMS[id].kinobazaURL ? 1 : 0);
    if (cardCalls.length) assert.equal(cardCalls[0].url, HELD_OUT_FILMS[id].kinobazaURL);
    assert.ok(cardCalls.length ? ['ok', 'partial'].includes(r.sources[2].status) : r.sources[2].status === 'disabled-no-request');
  }
  assert.equal(calls.length, 14);
  assert.equal(calls.filter(c => c.url.includes('themoviedb')).length, 8);
  assert.equal(calls.filter(c => c.url.includes('movieofthenight')).length, 4);
  for (const id of heldIds) await assert.rejects(runDiscovery({ ...choose(id), requestBudget: 99 }), /Fixed discovery/);
});

test('held-out canonical redirect refusal preserves independent source results and counts one card GET', async () => {
  for (const id of ['kingdom-of-heaven', 'parasite']) {
    const calls = [], r = await mockRun(id, calls, { redirect: true });
    assert.equal(calls.length, 4); assert.equal(r.stages.kinobaza.result.status, 'redirect-not-followed');
    assert.ok(r.rows.some(row => row.id.startsWith('motn:')));
    assert.doesNotMatch(JSON.stringify(r), /private.invalid/);
    assert.equal(canonicalRedirectTarget(HELD_OUT_FILMS[id].kinobazaURL, HELD_OUT_FILMS[id].kinobazaURL, 301), null);
  }
});

test('cross-Thing stable IDs are conflicts, not same-title matches; good source survives', async () => {
  for (const [id, other] of [['the-thing-1982', 'the-thing-2011'], ['the-thing-2011', 'the-thing-1982']]) {
    const data = authoredDiscoveryData(HELD_OUT_FILMS[other]);
    assert.equal(projectTmdbIdentity(data.tmdb.details, id).identity.status, 'mismatch');
    assert.equal(normalizeMotn(data.motn, id).identity.status, 'mismatch');
    const r = await mockRun(id, [], { mutate: d => { d.tmdb.details.imdb_id = HELD_OUT_FILMS[other].imdbId; } });
    const matching = describeDiscovery(r);
    assert.equal(matching.subjects[0].outcome, 'conflicting');
    assert.equal(matching.subjects[1].outcome, 'compatible');
    assert.ok(r.rows.every(row => !row.id.startsWith('tmdb:')));
  }
});

test('configured Kinobaza identity uses labelled director aliases, exact card path and optional canonical evidence', async () => {
  for (const id of ['kingdom-of-heaven', 'parasite']) {
    const film = HELD_OUT_FILMS[id], data = authoredDiscoveryData(film);
    for (const director of film.directorAliases) {
      const h = data.html.replace(film.director, director);
      assert.equal((await extractHtml(h, film)).identity.status, 'matched');
    }
    for (const canonical of ['https://evil.invalid/titles/parasite-2019', 'https://kinobazaua.com/titles/parasite', 'http://kinobazaua.com/titles/parasite-2019']) {
      const h = data.html.replace('<head>', `<head><link rel="canonical" href="${canonical}">`);
      assert.equal((await extractHtml(h, film)).identity.status, 'unresolved');
    }
    for (const h of [data.html.replace(film.director, 'UNRELATED director'), data.html.replace('<h1>', '<h1>Wrong year (1900)</h1><h1>'),
      data.html.replace('id="availabilityAccordion"', 'id="unsupported-layout"')]) {
      assert.notEqual((await extractHtml(h, film)).status, 'ok');
    }
    const wrong = { ...htmlScenario(film, { discovery: 'digital-ua' }), sourceURL: film.kinobazaURL + '?override=1' };
    const { fetchHtmlCandidates } = await import('../html-source.mjs');
    await assert.rejects(fetchHtmlCandidates(wrong, () => assert.fail('No request')), /Fixed HTML/);
  }
});

test('Kingdom film/card does not prove cut; Parasite catalogue text cannot become offered tracks or draft fields', async () => {
  for (const id of ['kingdom-of-heaven', 'parasite']) {
    const r = await mockRun(id, [], { mutate: d => {
      d.html = d.html.replace('</body>', "<p>Authored film-level Director's Cut description; not an offer</p></body>");
      for (const o of d.motn.streamingOptions.ua) { o.audios = []; o.subtitles = []; delete o.quality; delete o.price; }
    } });
    const matching = describeDiscovery(r);
    assert.ok(r.rows.every(row => row.cut.state === 'unknown'));
    for (const row of r.rows.filter(row => row.id.startsWith('motn:'))) {
      assert.equal(row.audio.ukrainian.length, 0); assert.equal(row.subtitles.ukrainian.length, 0);
      const draft = prepareDraft(r, row);
      assert.equal(draft.fields.year, String(HELD_OUT_FILMS[id].year));
      assert.equal(draft.fields.imdb_url, `https://www.imdb.com/title/${HELD_OUT_FILMS[id].imdbId}/`);
      assert.doesNotMatch(JSON.stringify(draft.fields), /Director's Cut|audio|subtitles|quality|price|ВИГАДАНА/);
    }
    assert.ok(matching.rows.every(row => row.scopeGaps.includes('version-unknown')));
    assert.ok(r.stages.tmdb.result.identity.localization.ukrainianCatalogueTitle.includes('explicit-uk'));
  }
});

test('reviewed Parasite title/director aliases keep stable gates; unseen names stay unresolved', () => {
  const data = authoredDiscoveryData(HELD_OUT_FILMS.parasite).motn;
  for (const title of HELD_OUT_FILMS.parasite.titleAliases) for (const director of HELD_OUT_FILMS.parasite.directorAliases) {
    assert.equal(normalizeMotn({ ...data, originalTitle: title, directors: [director] }, 'parasite').identity.status, 'matched');
  }
  assert.equal(normalizeMotn({ ...data, directors: ['UNREVIEWED name'] }, 'parasite').identity.status, 'unresolved');
  assert.equal(normalizeMotn({ ...data, imdbId: 'tt0905372' }, 'parasite').identity.status, 'mismatch');
});

test('all held-out synthetic cases make zero external requests and reports use fixed safe film labels', async () => {
  for (const id of heldIds) {
    const r = await runDiscovery(choose(id), { fetchImpl: () => assert.fail('Synthetic network') });
    assert.equal(r.metrics.requestsMade, 0); assert.equal(r.synthetic, true);
    const report = buildShortReport({ filmId: id, mode: 'synthetic', result: { ...r, matching: describeDiscovery(r) }, draft: {} });
    assert.match(report, /SYNTHETIC/); assert.match(report, /Commit: unknown/);
    assert.doesNotMatch(report, /held-offline|api\.themoviedb|api\.movieofthenight|https:/);
  }
});

test('HTTP six-film picker: per-film budget/on-off, startup Thing does not disable later cards; body overrides ignored', async t => {
  const calls = [], server = createDemo({ retrieval: 'ua-discovery', discovery: 'digital-ua', filmId: 'the-thing-1982',
    mode: 'live', tmdbToken: 'held-offline-token', motnKey: 'held-offline-key', fetchImpl: heldMock(calls) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const id of heldIds) {
    const session = await fetch(origin + '/session?film=' + id).then(r => r.json());
    assert.equal(session.films.length, 6); assert.equal(session.requestBudget, choose(id).requestBudget);
    assert.equal(session.kinobaza, choose(id).kinobaza); assert.deepEqual(session.conditionalRequests, []);
    assert.equal(session.plannedRequests.length, choose(id).requestBudget);
    if (HELD_OUT_FILMS[id].kinobazaURL) assert.ok(session.plannedRequests.includes(HELD_OUT_FILMS[id].kinobazaURL));
    assert.doesNotMatch(JSON.stringify(session), /held-offline/);
    const init = { method: 'POST', headers: { Origin: origin, 'x-demo-session': session.token },
      body: JSON.stringify({ film: 'evil', url: 'https://private.invalid', kinobaza: 'on' }) };
    const response = await fetch(origin + '/answer', init);
    assert.equal(response.status, 200); assert.equal((await response.json()).result.film.id, id);
    assert.equal((await fetch(origin + '/answer', init)).status, 409);
  }
  assert.equal(calls.length, 14);
  assert.equal((await fetch(origin + '/session?film=parasite&url=evil')).status, 400);
  assert.equal((await fetch(origin + '/session?film=not-configured')).status, 400);
});
