// Authored fixtures only. These are not historical source HTML, independent
// person checks or platform availability assertions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'parse5';
import { assistedIdentity, fetchAssistedKinobaza } from '../netlify/lib/kinobaza-card.mjs';
import { CARD, markup } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';
import { paragraphBlock, netflixCatalogueBlock } from '../research/grounded-answer-demo/test/kinobaza-localization.fixture.mjs';
import { createKinobazaResolver } from '../netlify/lib/kinobaza-resolver.mjs';
import { composeDiscovery } from '../research/grounded-answer-demo/discovery.mjs';
import { mediaCapabilities, productMediaResult } from '../netlify/lib/media-advice-response.mjs';
import { presentMediaGroups } from '../assets/media-advice-presentation.mjs';
import { linkChoicesFor, makePreview, applyPreview } from '../assets/media-advice.mjs';

const person = (id, name) => ({ namespace: 'tmdb:person', personId: id, names: [name] });
const film = { id: 'authored-director-group', identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2001,
  imdbId: 'tt999900001', tmdbId: 999900001, titleAliases: [], directorCount: 3,
  directorAliases: ['Author One', 'Author Two', 'Author Three'],
  directorPeople: [person(999900001, 'Author One'), person(999900002, 'Author Two'), person(999900003, 'Author Three')] };
const single = { ...film, directorCount: 1, directorAliases: ['Author One'], directorPeople: [film.directorPeople[0]] };
const member = (suffix, name, absolute = false) => `<a href="${absolute ? 'https://kinobazaua.com' : ''}/persons/authored-${suffix}">${name}</a>`;
const group = [member('one', 'Source One'), member('two', 'Source Two'), member('three', 'Source Three')].join(', ');
const movie = extra => ({ '@context': 'https://schema.org', '@type': 'Movie', '@id': CARD + '#movie', url: CARD,
  name: film.identityTitle, sameAs: ['https://www.imdb.com/title/' + film.imdbId + '/', 'https://www.themoviedb.org/movie/' + film.tmdbId], ...extra });
const source = ({ semantic = movie(), director = group, plural = false, ...options } = {}) => markup({ director, ...options })
  .replace('<td>Режисер:</td>', `<td>${plural ? 'Режисери:' : 'Режисер:'}</td>`).replace('</head>',
    (semantic === null ? '' : `<script type="application/ld+json">${JSON.stringify(semantic)}</script>`) + '</head>');
const nodes = html => {
  const all = [], stack = [parse(html, { sourceCodeLocationInfo: true })];
  while (stack.length) { const node = stack.pop(); all.push(node); if (!['script', 'style', 'template', 'noscript', 'iframe'].includes(node.tagName)) stack.push(...node.childNodes ?? []); }
  return all;
};
const noCrosswalk = () => ({ status: 'unresolved' });
const inspect = (options, selected = film, extra = {}) => assistedIdentity(nodes(source(options)), selected, CARD,
  { directorAliasLookup: noCrosswalk, ...extra });
const skipped = result => {
  assert.equal(result.status, 'matched'); assert.equal(result.reason, 'explicit-stable-title-year-match');
  assert.equal(result.diagnostics.strategy, 'stable-id-title-year');
  for (const gate of ['director-presence', 'director-scope', 'director-alias']) assert.equal(result.diagnostics.gates[gate], 'not-evaluated');
  assert.equal(result.directorAliasEvidence, undefined);
};

for (const [description, director, selected] of [
  ['one bounded field with three relative profiles', group, film],
  ['one bounded field with absolute profiles', [member('one', 'Source One', true), member('two', 'Source Two', true)].join(', '), film],
  ['one source profile and several trusted selected people', member('one', 'Source One'), film],
  ['several source people and one trusted selected person', group, single],
]) test(`owned ID/exact titles/year can skip legitimate director cardinality: ${description}`, () => {
  const result = inspect({ director }, selected); skipped(result);
  assert.equal(result.diagnostics.comparisons.stableIdMatch, true);
  assert.equal(result.diagnostics.comparisons.stableIdConflict, false);
});

test('a plural film-credit label preserves every explicitly linked source director without making person claims', () => {
  const result = inspect({ plural: true }); skipped(result);
  assert.equal(result.observed.directorCount, 3);
  assert.equal(result.diagnostics.comparisons.directorAliasMatch, false);
});

test('plural credit fields permit explicit profile groups separated by br, semicolon or ampersand', () => {
  for (const separator of ['<br>', '; ', ' &amp; ']) {
    skipped(inspect({ plural: true, director: [member('one', 'Source One'), member('two', 'Source Two')].join(separator) }));
  }
});

test('plural no-ID credits cannot be confirmed by a flat list of all known aliases', () => {
  const result = inspect({ plural: true, semantic: null,
    director: [member('one', 'Author One'), member('two', 'Author Two'), member('three', 'Author Three')].join(', ') });
  assert.equal(result.status, 'unresolved'); assert.equal(result.reason, 'director-scope-unestablished');
  assert.equal(result.observed.directorCount, 3);
});

for (const [description, options] of [
  ['no shared ID', { semantic: null }],
  ['no shared ID even when all group spellings are known', { semantic: null,
    director: [member('one', 'Author One'), member('two', 'Author Two'), member('three', 'Author Three')].join(', ') }],
  ['unrelated semantic ID', { semantic: movie({ url: CARD + '-other' }) }],
  ['a differing H1 year', { year: 2002 }],
]) test(`director group remains unconfirmed on the director-required route: ${description}`, () => {
  const result = inspect(options);
  assert.equal(result.status, 'unresolved'); assert.equal(result.reason, 'director-scope-unestablished');
});

for (const [expected, heading, original] of [
  ['Гладіатор II', 'Гладіатор ІІ', 'Gladiator II'],
  ['Конг', 'Конґ', 'Kong'],
  ['Відомий переклад', 'Інший переклад', 'Authored original'],
]) test(`weak title bridge still requires director proof despite owned ID: ${expected}`, () => {
  const selected = { ...film, identityTitle: expected, originalTitle: original, titleAliases: [expected, original] };
  const result = inspect({ title: heading, original, semantic: movie({ name: heading }) }, selected);
  assert.equal(result.status, 'unresolved'); assert.equal(result.reason, 'director-scope-unestablished');
});

for (const [description, options] of [
  ['two actual director fields', { stable: '<tr><td>Режисер:</td><td>' + member('other', 'Other Source') + '</td></tr>' }],
  ['opaque unstructured combined names', { director: 'Source One, Source Two, Source Three' }],
  ['opaque plural field without structured profiles', { plural: true, director: 'Source One and Source Two' }],
  ['an external link among group members', { director: member('one', 'Source One') + ', <a href="https://example.invalid/person/source-two">Source Two</a>' }],
  ['a film link among group members', { director: member('one', 'Source One') + ', <a href="/titles/authored-other">Source Two</a>' }],
  ['a parameterized person link among group members', { director: member('one', 'Source One') + ', <a href="/persons/authored-two?private=DO_NOT_PUBLISH">Source Two</a>' }],
  ['a person group with unstructured trailing text', { director: group + ' Additional unscoped name' }],
  ['repeated profile URLs masquerading as a group', { director: member('one', 'Source One') + ', ' + member('one', 'Other Source Name') }],
  ['more than 32 profile members', { plural: true, director: Array.from({ length: 33 }, (_, index) => member('person-' + index, 'Source ' + index)).join(', ') }],
]) test(`sameAs does not erase genuinely ambiguous director metadata: ${description}`, () => {
  const result = inspect(options);
  assert.equal(result.status, 'unresolved'); assert.equal(result.reason, 'director-scope-unestablished');
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_PUBLISH/);
});

test('existing no-ID single-person proof remains available for singular and plural metadata labels', () => {
  for (const plural of [false, true]) {
    const result = inspect({ semantic: null, plural, director: member('one', 'Author One') }, single);
    assert.equal(result.status, 'matched'); assert.equal(result.reason, 'explicit-title-year-director-match');
    assert.equal(result.diagnostics.gates['director-alias'], 'pass');
  }
});

for (const [description, semantic, stable = ''] of [
  ['conflicting IMDb', movie({ sameAs: ['https://www.imdb.com/title/tt999900002/'] })],
  ['matching IMDb but conflicting TMDb', movie({ sameAs: ['https://www.imdb.com/title/tt999900001/', 'https://www.themoviedb.org/movie/999900002'] })],
  ['two different same-system IDs', movie({ sameAs: ['https://www.imdb.com/title/tt999900001/', 'https://www.imdb.com/title/tt999900002/'] })],
  ['conflicting labelled ID despite owned matching ID', movie(), '<tr><td>IMDb:</td><td>tt999900002</td></tr>'],
]) test(`ID conflict takes priority over multi-director scope: ${description}`, () => {
  const result = inspect({ semantic, stable });
  assert.equal(result.status, 'mismatch'); assert.equal(result.reason, 'source-stable-id-conflict');
  assert.equal(result.diagnostics.failedGate, 'stable-id-conflict');
});

for (const [description, options, reason] of [
  ['different original title', { original: 'Other Original' }, 'source-original-title-unestablished'],
  ['different sequel', { title: film.identityTitle + ' 2', semantic: movie({ name: film.identityTitle + ' 2' }) }, 'source-title-conflict'],
  ['different canonical', { url: CARD + '-other' }, 'source-canonical-conflict'],
  ['two owned Movie objects', { semantic: [movie(), movie()] }, 'source-identity-structure-incomplete'],
  ['duplicate original headings', {}, 'source-original-title-scope-unestablished'],
]) test(`matching semantic ID and director group do not bypass ${description}`, () => {
  const html = description === 'duplicate original headings' ? source(options).replace('<h2>Authored original</h2>', '<h2>Authored original</h2><h2>Other Original</h2>') : source(options);
  const result = assistedIdentity(nodes(html), film, CARD, { directorAliasLookup: noCrosswalk });
  assert.notEqual(result.status, 'matched'); assert.equal(result.reason, reason);
});

test('an already proven conflict on an exact single linked person remains blocking', () => {
  const sourceAlias = 'Source One', sourceURL = 'https://kinobazaua.com/persons/authored-one';
  let checks = 0;
  const result = inspect({ director: member('one', sourceAlias) }, single, { directorConflictLookup: pointer => {
    checks++; assert.deepEqual(pointer, { sourceURL, sourceAlias }); return true;
  } });
  assert.equal(checks, 1); assert.equal(result.status, 'unresolved'); assert.equal(result.reason, 'director-known-person-conflict');
});

test('a known conflict for any exact member of a clean plural group still blocks semantic bypass', () => {
  const checks = [];
  const result = inspect({ plural: true }, film, { directorConflictLookup: pointer => {
    checks.push(pointer);
    return pointer.sourceURL === 'https://kinobazaua.com/persons/authored-two';
  } });
  assert.deepEqual(checks, [
    { sourceURL: 'https://kinobazaua.com/persons/authored-one', sourceAlias: 'Source One' },
    { sourceURL: 'https://kinobazaua.com/persons/authored-two', sourceAlias: 'Source Two' },
    { sourceURL: 'https://kinobazaua.com/persons/authored-three', sourceAlias: 'Source Three' },
  ]);
  assert.equal(result.status, 'unresolved'); assert.equal(result.reason, 'director-known-person-conflict');
  assert.equal(result.diagnostics.failedGate, 'director-alias');
});

test('an unconfirmed group-profile lookup is not represented as a proven conflict', () => {
  for (const lookup of [() => false, () => ({ status: 'unresolved' })]) {
    skipped(inspect({ plural: true }, film, { directorConflictLookup: lookup }));
  }
});

test('HTML to localization succeeds without person requests or a fabricated group alias proof', async () => {
  let requests = 0, personRequests = 0;
  const result = await fetchAssistedKinobaza(CARD, film, async (url, init) => {
    requests++; assert.equal(url, CARD); assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual');
    return new Response(source(), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }, { directorAliasLookup: noCrosswalk, verifyDirector: async () => { personRequests++; return { status: 'unresolved' }; } });
  skipped(result.identity); assert.equal(requests, 1); assert.equal(personRequests, 0);
  assert.ok(result.localization.blocks.length > 0);
  assert.ok(result.candidates.some(candidate => candidate.href === 'https://tv.apple.com/ua/movie/authored/umc.cmc.authoronly?at=AUTHOR%2fONLY'));
});

for (const sourceCap of [8, 10, 12, 14]) test(`plural-group HTML reaches both authorized presentations and exact preview within cap${sourceCap}`, async () => {
  const searchURL = 'https://api.tavily.com/search';
  const megogoURL = 'https://megogo.net/ua/view/999900001-authored.html?exact=%2f&x=1';
  const netflixURL = 'https://www.netflix.com/title/999900002?exact=%2F&x=1';
  const blocks = paragraphBlock('megogo', '(укр. аудіо [5.1])', megogoURL.replaceAll('&', '&amp;')) +
    netflixCatalogueBlock({ href: netflixURL.replaceAll('&', '&amp;'), caption: '(укр. субтитри)' });
  // Keep the identity boundary but remove unrelated authored regional offers.
  const html = source({ plural: true, blocks }).replace(/<div id="availabilityAccordion">[\s\S]*<\/body>/,
    '<div id="availabilityAccordion"></div></body>');
  const baseline = ['tmdb-find', 'tmdb-details', 'tmdb-providers', 'motn-title'];
  const calls = baseline.map(stage => ({ stage, status: 'response-received' }));
  const reserved = [], requests = [], payloads = [];
  const resolved = await createKinobazaResolver({ apiKey: 'AUTHORED_SEARCH_KEY' })(film, {
    sourceCap, diagnostics: true, calls, tmdbToken: 'AUTHORED_PERSON_KEY',
    reserve: async stage => {
      assert.ok(calls.length < sourceCap); assert.ok(!reserved.includes(stage)); reserved.push(stage);
    },
    fetchImpl: async (url, init) => {
      requests.push(url); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
      if (url === searchURL) {
        assert.equal(init.method, 'POST'); payloads.push(JSON.parse(init.body));
        return Response.json({ request_id: 'authored-group-request', query: 'Authored original 2001', results: [{ url: CARD }] });
      }
      assert.equal(url, CARD, 'no person, destination, catalogue, generated or other film requests');
      assert.equal(init.method, 'GET');
      assert.equal(new Headers(init.headers).has('authorization'), false);
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    },
  });
  skipped(resolved.result.identity);
  assert.deepEqual(requests, [searchURL, CARD]);
  assert.deepEqual(reserved, ['search-1', 'kinobaza-1']);
  assert.equal(calls.length, 6); assert.ok(calls.length <= sourceCap);
  assert.equal(resolved.resolver.searchCalls, 1); assert.equal(resolved.resolver.cardCalls, 1);
  assert.equal(resolved.resolver.directorProfile.sourceAttempts, 0);
  assert.equal(resolved.resolver.possibleIrrelevantSearch, undefined);
  if (sourceCap === 14) assert.equal(resolved.resolver.predicted.reason, 'prior-card-confirmed');
  else assert.equal(resolved.resolver.predicted, undefined);
  assert.equal(payloads[0].search_depth, 'basic'); assert.notEqual(payloads[0].exact_match, true);
  assert.equal(payloads[0].query, '"Authored original" 2001 site:kinobazaua.com/titles/');

  const discovery = { ...composeDiscovery(film, { tmdb: { result: null }, motn: { result: null }, kinobaza: resolved }),
    resolver: resolved.resolver };
  assert.deepEqual([...new Set(discovery.rows.map(row => row.provider.key))].sort(), ['megogo', 'netflix']);
  const presentations = [];
  for (const diagnostics of [false, true]) {
    // Authored server-authorized receipts mirror the existing response branch;
    // this test does not substitute browser input for a real permission RPC.
    const capabilities = mediaCapabilities({ mykola_media_advice: true, mykola_media_advice_diagnostics: diagnostics });
    const projected = capabilities.mykola_media_advice_diagnostics ? { ...discovery, capabilities } : productMediaResult(discovery, capabilities);
    assert.equal(Boolean(projected.resolver), diagnostics);
    if (!diagnostics) assert.doesNotMatch(JSON.stringify(projected), /"(?:resolver|stages|metrics|movieSameAs|directorPeople|identityContext)"|AUTHORED_SEARCH_KEY|AUTHORED_PERSON_KEY/);
    const shown = presentMediaGroups(projected.rows, { filmId: film.id });
    assert.deepEqual(shown.map(info => info.group.key).sort(), ['megogo', 'netflix']);
    presentations.push(shown.map(info => ({ key: info.group.key, comparison: info.comparison })));
    for (const [provider, expectedURL, audio, subtitles] of [
      ['megogo', megogoURL, '+', '?'], ['netflix', netflixURL, '?', '+'],
    ]) {
      const info = shown.find(value => value.group.key === provider);
      assert.equal(info.comparison.availability.symbol, '◐');
      assert.equal(info.comparison.audio.symbol, audio); assert.equal(info.comparison.subtitles.symbol, subtitles);
      const choices = linkChoicesFor(info); assert.equal(choices.length, 1); assert.equal(choices[0].href, expectedURL);
      const form = { recommended_medium: 'DVD', purchase_url: 'https://example.com/unchanged-manual' }, original = { ...form };
      const preview = makePreview(info.transferRow, form);
      assert.equal(preview.after.purchase_url, expectedURL); assert.deepEqual(form, original, 'preview does not mutate the form');
      const applied = applyPreview(preview, form);
      assert.equal(applied.purchase_url, expectedURL); assert.deepEqual(form, original, 'explicit apply returns changes for ordinary Save, not an immediate write');
    }
  }
  assert.deepEqual(presentations[0], presentations[1]);
});
