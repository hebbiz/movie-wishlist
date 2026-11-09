// Authored fictional film/person IDs, source markup and transports only. These
// are not captured live responses, historical reconstructions or offer proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sameUkrainianGTitle } from '../shared/ukrainian-g-title.mjs';
import { fetchAssistedKinobaza } from '../netlify/lib/kinobaza-card.mjs';
import { markup, CARD } from './assisted-kinobaza.fixture.mjs';
import { netflixAudioCatalogueBlock } from './kinobaza-localization.fixture.mjs';
import { createKinobazaResolver } from '../netlify/lib/kinobaza-resolver.mjs';
import { composeDiscovery } from '../netlify/lib/media-discovery-compose.mjs';
import { productMediaResult } from '../netlify/lib/media-advice-response.mjs';
import { presentMediaGroups } from '../assets/media-advice-presentation.mjs';
import { linkChoicesFor, makePreview } from '../assets/media-advice.mjs';
import { safeMediaReport } from '../assets/media-advice-report.mjs';

const SEARCH = 'https://api.tavily.com/search';
const PERSON = 999998;
const TMDB_PERSON = `https://api.themoviedb.org/3/person/${PERSON}?language=en-US&append_to_response=external_ids`;
const TMDB_KEY = 'AUTHORED_PRIVATE_PERSON_CREDENTIAL';
const SEARCH_KEY = 'AUTHORED_PRIVATE_SEARCH_CREDENTIAL';
const ALIAS = 'Авторський режисер';
const LATIN = 'Authored Director';
const URLS = ['https://kinobazaua.com/titles/authored-first', 'https://kinobazaua.com/titles/authored-second'];
const PROFILES = ['https://kinobazaua.com/persons/authored-first-person', 'https://kinobazaua.com/persons/authored-second-person'];
const LINK = 'https://www.netflix.com/title/900009998?exact=%2f#AuthorOnly';
const FILM = { id: 'imdb:tt999900008', tmdbId: 999900008, imdbId: 'tt999900008',
  identityTitle: 'Ґрані острова', originalTitle: 'Authored Island', year: 2008,
  titleAliases: ['Another Known Authored Alias'], directorCount: 1,
  directorAliases: [LATIN], directorPeople: [{ namespace: 'tmdb:person', personId: PERSON, names: [LATIN] }] };
const idRow = (namespace = 'imdb', id = namespace === 'imdb' ? FILM.imdbId : FILM.tmdbId) =>
  `<tr><td>${namespace === 'imdb' ? 'IMDb' : 'TMDb'}:</td><td>${id}</td></tr>`;
const sourceMarkup = (options = {}) => markup({ title: 'Грані острова', original: FILM.originalTitle,
  year: FILM.year, director: LATIN, blocks: netflixAudioCatalogueBlock({ href: LINK }), ...options });
const linked = profile => `<a href="${profile}">${ALIAS}</a>`;
const personData = { id: PERSON, name: LATIN, also_known_as: [], birthday: '1967-05-20',
  imdb_id: 'nm9999998', external_ids: { imdb_id: 'nm9999998' } };
function personPage(url, { native = ALIAS, latin = LATIN, birthday = '20 травня 1967', semantic = '' } = {}) {
  return `<!doctype html><html><head><link rel="canonical" href="${url}">${semantic}</head><body><div class="col-8"><h1 class="h2">${native}</h1><h2 class="h3 text-muted">${latin}</h2>${birthday === null ? '' : `<p>Дата народження: ${birthday}</p>`}<p>Ролі: режисер</p></div></body></html>`;
}

async function card({ selected = FILM, html = sourceMarkup() } = {}) {
  let requests = 0;
  const result = await fetchAssistedKinobaza(CARD, selected, async (url, init) => {
    requests++; assert.equal(url, CARD); assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  });
  assert.equal(requests, 1, 'localized spelling alone cannot introduce another request');
  if (result.identity?.status !== 'matched') {
    assert.deepEqual(result.candidates, []); assert.equal(result.localization, undefined);
  }
  return result;
}

for (const [left, right] of [
  ['Ґрані острова', 'Грані острова'],
  ['Грані острова', 'Ґрані острова'],
  ['Пригоди Ґанґа', 'Пригоди Ганга'],
  ['ҐРАні  острова', 'грані острова'],
  ['Ґрані острова: 2', 'Грані острова: 2'],
]) test(`Ukrainian г/ґ helper accepts only the spelling variance: ${left}`, () => {
  assert.equal(sameUkrainianGTitle(left, right), true);
});

for (const [name, left, right] of [
  ['different word', 'Ґрані острова', 'Грані островів'],
  ['different sequel', 'Ґрані острова 2', 'Грані острова 3'],
  ['other Ukrainian letter', 'Ґрані острова', 'Грани острова'],
  ['Latin homoglyph', 'Ґрані острова', 'Гранi острова'],
  ['Latin G', 'Ґрані острова', 'Gрані острова'],
  ['mixed script even when shared', 'Ґрані Island', 'Грані Island'],
  ['Latin-only title', 'G Authored Island', 'G Authored Island'],
  ['changed punctuation', 'Ґрані: острова', 'Грані острова'],
  ['changed apostrophe', 'Ґрані\' острова', 'Грані’ острова'],
  ['control character', 'Ґрані\u0000острова', 'Грані\u0000острова'],
  ['no affected letters', 'Острів', 'Острів'],
  ['empty values', '', ''],
  ['missing value', null, 'Грані острова'],
  ['non-string value', 2, 'Грані острова'],
  ['oversized input', 'Ґ'.repeat(501), 'Г'.repeat(501)],
]) test(`Ukrainian г/ґ helper rejects ${name}`, () => {
  assert.equal(sameUkrainianGTitle(left, right), false);
});

test('localized г/ґ spelling with exact original/year and already proven single director reaches identity matched', async () => {
  const out = await card();
  assert.equal(out.identity.status, 'matched');
  assert.equal(out.identity.diagnostics.strategy, 'title-ukrainian-g-year-director');
  assert.equal(out.identity.diagnostics.gates['director-alias'], 'pass');
  assert.equal(out.identity.diagnostics.comparisons.originalAliasMatch, true);
});

for (const namespace of ['imdb', 'tmdb']) {
  test(`a matching ${namespace} film ID cannot bypass director proof on the г/ґ route`, async () => {
    const out = await card({ html: sourceMarkup({ stable: idRow(namespace), director: ALIAS }) });
    assert.equal(out.identity.status, 'unresolved'); assert.equal(out.identity.reason, 'director-alias-unestablished');
    assert.equal(out.identity.diagnostics.comparisons.stableIdMatch, true);
    assert.equal(out.identity.diagnostics.gates['heading-alias'], 'pass');
    assert.equal(out.identity.diagnostics.gates['original-alias'], 'pass');
  });
  test(`a conflicting ${namespace} film ID retains priority before title/person fallback`, async () => {
    const out = await card({ html: sourceMarkup({ stable: idRow(namespace, namespace === 'imdb' ? 'tt999900009' : 999900009), director: ALIAS }) });
    assert.equal(out.identity.status, 'mismatch'); assert.equal(out.identity.reason, 'source-stable-id-conflict');
    assert.equal(out.identity.diagnostics.gates['heading-alias'], 'not-evaluated');
  });
}

for (const original of ['Another Original Island', 'Another Known Authored Alias', 'Authored Іsland']) {
  test(`г/ґ route requires actual trusted original title, not ${original}`, async () => {
    const out = await card({ html: sourceMarkup({ original, stable: idRow() }) });
    assert.equal(out.identity.status, 'unresolved'); assert.equal(out.identity.reason, 'source-original-title-unestablished');
    assert.equal(out.identity.diagnostics.comparisons.originalAliasMatch, false);
  });
}

for (const stable of ['', idRow()]) test(`г/ґ route retains primary year despite release evidence and ${stable ? 'matching' : 'missing'} film ID`, async () => {
  const selected = { ...FILM, identityContext: { tmdbId: FILM.tmdbId,
    releaseEvidence: [{ date: '2006-09-09T00:00:00.000Z', year: 2006, type: 1, country: 'CA' }] } };
  const out = await card({ selected, html: sourceMarkup({ year: 2006, stable }) });
  assert.equal(out.identity.status, 'mismatch'); assert.equal(out.identity.reason, 'source-year-conflict-ukrainian-g-title');
  assert.equal(out.identity.diagnostics.gates['year-crosswalk'], 'fail');
  assert.match(safeMediaReport({ resolver: { cards: [{ identity: 'mismatch', reason: out.identity.reason, diagnostics: out.identity.diagnostics }] } }), /source-year-conflict-ukrainian-g-title/);
});

for (const [name, selected, options, reason] of [
  ['missing source director', FILM, { director: '' }, 'source-or-selected-director-missing'],
  ['unknown source director', FILM, { director: 'Other Director' }, 'director-alias-unestablished'],
  ['missing selected director', { ...FILM, directorAliases: [] }, {}, 'source-or-selected-director-missing'],
  ['multiple selected directors', { ...FILM, directorCount: 2 }, {}, 'director-scope-unestablished'],
  ['multiple source directors', FILM, { stable: idRow() + '<tr><td>Режисер:</td><td>Other Director</td></tr>' }, 'director-scope-unestablished'],
]) test(`г/ґ route cannot establish identity for ${name}`, async () => {
  const out = await card({ selected, html: sourceMarkup({ stable: idRow(), ...options }) });
  assert.equal(out.identity.status, 'unresolved'); assert.equal(out.identity.reason, reason);
});

test('ambiguous originals and canonical conflicts remain withheld on the г/ґ route', async () => {
  const ambiguous = await card({ html: sourceMarkup().replace('<h2>Authored Island</h2>', '<h2>Authored Island</h2><h2>Another Original</h2>') });
  assert.equal(ambiguous.identity.reason, 'source-original-title-scope-unestablished');
  const conflict = await card({ html: sourceMarkup({ url: URLS[0] }) });
  assert.equal(conflict.identity.reason, 'source-canonical-conflict');
});

async function resolver({ sourceCap = 10, cards = [{ original: 'Another Original' }, {}], person = {}, profiles = {}, selected = FILM } = {}) {
  const reserved = [], requests = [];
  const calls = ['tmdb-find', 'tmdb-details', 'tmdb-providers', 'motn'].map(stage => ({ stage, status: 'response-received' }));
  const out = await createKinobazaResolver({ apiKey: SEARCH_KEY })(selected, {
    sourceCap, tmdbToken: TMDB_KEY, calls,
    reserve: async stage => {
      assert.ok(calls.length < sourceCap); assert.ok(!reserved.includes(stage)); reserved.push(stage);
    },
    fetchImpl: async (url, init) => {
      requests.push(url); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
      if (url === SEARCH) {
        assert.equal(init.method, 'POST'); assert.equal(reserved.at(-1), `search-${requests.filter(u => u === SEARCH).length}`);
        assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${SEARCH_KEY}`);
        return Response.json({ results: URLS.map(url => ({ url, content: 'PRIVATE_UNTRUSTED_SNIPPET', score: 1 })) });
      }
      if (url === TMDB_PERSON) {
        assert.equal(reserved.at(-1), 'tmdb-person'); assert.equal(init.method, 'GET');
        assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${TMDB_KEY}`);
        return Response.json({ ...personData, ...person });
      }
      assert.equal(new Headers(init.headers).has('authorization'), false); assert.equal(new Headers(init.headers).has('cookie'), false);
      if (PROFILES.includes(url)) {
        assert.equal(reserved.at(-1), 'kinobaza-person');
        return new Response(personPage(url, profiles[url]), { headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      assert.ok(URLS.includes(url), 'only admitted supplied cards/profiles, not source search, destinations or generated pointers');
      const index = URLS.indexOf(url), config = cards[index];
      assert.equal(reserved.at(-1), `kinobaza-${index + 1}`);
      return new Response(sourceMarkup({ url, director: linked(config.profile ?? PROFILES[index]), ...config }),
        { headers: { 'content-type': 'text/html; charset=utf-8' } });
    },
  });
  assert.ok(calls.length <= sourceCap); assert.ok(out.resolver.searchCalls <= 2); assert.equal(out.resolver.cardCalls, 2);
  assert.deepEqual(requests.filter(url => URLS.includes(url)), URLS);
  assert.ok(requests.every(url => !url.startsWith('https://kinobazaua.com/search')));
  const diagnostic = JSON.stringify({ resolver: out.resolver, calls });
  assert.doesNotMatch(diagnostic, /AUTHORED_PRIVATE|PRIVATE_UNTRUSTED_SNIPPET|<html|1967|nm9999998|sourceAlias|also_known_as/);
  assert.doesNotMatch(safeMediaReport({ resolver: out.resolver }), /https?:|AUTHORED_PRIVATE|PRIVATE_UNTRUSTED_SNIPPET/);
  return { out, reserved, requests, calls };
}
const profileRequests = r => r.requests.filter(url => url === TMDB_PERSON || PROFILES.includes(url));

test('real resolver passes г/ґ title stage before deferring the selected second card to linked profiles within cap10', async () => {
  const result = await resolver();
  assert.deepEqual(result.reserved, ['search-1', 'kinobaza-1', 'search-2', 'kinobaza-2', 'tmdb-person', 'kinobaza-person']);
  assert.deepEqual(profileRequests(result), [TMDB_PERSON, PROFILES[1]]);
  assert.ok(result.requests.indexOf(TMDB_PERSON) > result.requests.indexOf(URLS[1]), 'both card opportunities precede the sole person pair');
  assert.equal(result.calls.length, 10); assert.equal(result.out.result.sourceURL, URLS[1]);
  assert.equal(result.out.resolver.cards[0].reason, 'source-original-title-unestablished');
  assert.equal(result.out.resolver.cards[0].candidates, 0);
  assert.equal(result.out.result.identity.status, 'matched');
  assert.equal(result.out.result.identity.diagnostics.strategy, 'title-ukrainian-g-year-director');
  assert.equal(result.out.result.identity.diagnostics.gates['director-alias'], 'pass');
  assert.equal(result.out.resolver.directorProfile.status, 'confirmed');
  assert.equal(result.out.resolver.directorProfile.basis, 'exact-name-birthdate-role');
  assert.equal(result.out.resolver.directorProfile.sourceAttempts, 2);
});

test('cap8 keeps both Tavily/card slots but cannot dispatch profile I/O after г/ґ admission', async () => {
  const result = await resolver({ sourceCap: 8 });
  assert.equal(result.calls.length, 8); assert.deepEqual(profileRequests(result), []);
  assert.deepEqual(result.reserved, ['search-1', 'kinobaza-1', 'search-2', 'kinobaza-2']);
  assert.equal(result.out.result, null); assert.deepEqual(result.out.choices, []);
  assert.equal(result.out.resolver.cards[1].reason, 'director-alias-unestablished');
  assert.equal(result.out.resolver.cards[1].candidates, 0);
});

for (const [name, cards] of [
  ['ID conflicts', [{ stable: idRow('imdb', 'tt999900009') }, { stable: idRow('tmdb', 999900009) }]],
  ['different originals', [{ original: 'Another Original' }, { original: 'Another Known Authored Alias' }]],
  ['year conflicts', [{ year: 2007 }, { year: 2009 }]],
  ['other localized titles', [{ title: 'Інша пригода' }, { title: 'Грані іншого острова' }]],
  ['ambiguous director scope', [{ director: linked(PROFILES[0]) + ' / Another Person' }, { director: linked(PROFILES[1]) + ' / Another Person' }]],
]) test(`real resolver never spends person attempts to bypass ${name}`, async () => {
  const result = await resolver({ cards });
  assert.equal(result.calls.length, 8); assert.deepEqual(profileRequests(result), []);
  assert.equal(result.out.result, null); assert.deepEqual(result.out.choices, []);
  assert.ok(result.out.resolver.cards.every(c => c.candidates === 0));
});

test('two equally supported г/ґ cards with different linked people remain ambiguous without speculative profile reads', async () => {
  const result = await resolver({ cards: [{}, {}] });
  assert.equal(result.calls.length, 8); assert.deepEqual(profileRequests(result), []);
  assert.equal(result.out.result, null); assert.deepEqual(result.out.choices, []);
  assert.equal(result.out.resolver.directorProfile.reason, 'director-profile-candidates-ambiguous');
});

test('a shared verified person does not collapse two different confirmed film cards', async () => {
  const result = await resolver({ cards: [{}, { profile: PROFILES[0] }] });
  assert.equal(result.calls.length, 10); assert.deepEqual(profileRequests(result), [TMDB_PERSON, PROFILES[0]]);
  assert.equal(result.out.status, 'multiple-confirmed-cards-choose'); assert.equal(result.out.result, null);
  assert.deepEqual(result.out.choices.map(c => c.sourceURL), URLS);
  assert.ok(result.out.choices.every(c => c.identity.status === 'matched' && c.candidates.length > 0));
});

for (const [name, options, reason, total] of [
  ['different trusted TMDb person', { person: { id: PERSON + 1 } }, 'tmdb-person-id-conflict', 9],
  ['namesake with conflicting birthday', { profiles: { [PROFILES[1]]: { birthday: '21 травня 1967' } } }, 'director-person-birthday-conflict', 10],
  ['same name without sufficient facts', { profiles: { [PROFILES[1]]: { birthday: null } } }, 'director-person-evidence-insufficient', 10],
  ['profile alias does not belong to source director', { profiles: { [PROFILES[1]]: { native: 'Інший авторський режисер' } } }, 'profile-source-alias-conflict', 10],
  ['explicit person ID conflict despite same name and birthday', { profiles: { [PROFILES[1]]: { semantic: `<script type="application/ld+json">${JSON.stringify({ '@type': 'Person', url: PROFILES[1], name: ALIAS, sameAs: 'https://www.imdb.com/name/nm9999997/' })}</script>` } } }, 'director-person-id-conflict', 10],
]) test(`г/ґ spelling never confirms film when linked profile has ${name}`, async () => {
  const result = await resolver(options);
  assert.equal(result.calls.length, total); assert.equal(result.out.result, null); assert.deepEqual(result.out.choices, []);
  assert.equal(result.out.resolver.directorProfile.reason, reason);
  assert.equal(result.out.resolver.cards[1].identity, 'unresolved');
  assert.equal(result.out.resolver.cards[1].reason, 'director-alias-unestablished');
  assert.equal(result.out.resolver.cards[1].candidates, 0);
});

test('verified г/ґ result reaches language table and exact local preview without exposing profile evidence to ordinary Beta', async () => {
  const { out } = await resolver();
  const result = composeDiscovery(FILM, { tmdb: { result: null }, motn: { result: null },
    kinobaza: { status: out.status, result: out.result } });
  const before = JSON.stringify(result);
  for (const diagnostic of [false, true]) {
    const capabilities = { mykola_media_advice: true, mykola_media_advice_diagnostics: diagnostic };
    const response = diagnostic ? { ...result, capabilities } : productMediaResult(result, capabilities);
    const info = presentMediaGroups(response.rows, { filmId: FILM.id }).find(info => info.group.key === 'netflix');
    assert.ok(info); assert.equal(info.band, 'ua-audio');
    assert.equal(info.comparison.availability.symbol, '◐'); assert.equal(info.comparison.audio.symbol, '+');
    assert.equal(info.comparison.subtitles.symbol, '+');
    const choices = linkChoicesFor(info); assert.equal(choices.length, 1); assert.equal(choices[0].href, LINK);
    const fields = { recommended_medium: 'DVD', purchase_url: 'https://example.com/authored-manual' };
    const preview = makePreview(choices[0].row, fields);
    assert.equal(preview.after.recommended_medium, 'Netflix'); assert.equal(preview.after.purchase_url, LINK);
    assert.deepEqual(fields, { recommended_medium: 'DVD', purchase_url: 'https://example.com/authored-manual' });
    if (!diagnostic) assert.doesNotMatch(JSON.stringify(response), /title-ukrainian-g-year-director|Authored Director|directorAliasEvidence|nm9999998/);
  }
  assert.equal(JSON.stringify(result), before, 'projection/presentation never mutate source records or perform Save');
  assert.match(safeMediaReport({ ...result, resolver: out.resolver }), /Identity route title-ukrainian-g-year-director/);
});
