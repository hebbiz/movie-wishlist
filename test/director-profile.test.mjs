// All names, person records and HTML below are authored regression fixtures,
// not reconstructions of historical Kinobaza responses or person evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'parse5';
import { admitDirectorProfileURL, projectTmdbPerson, inspectDirectorProfile, compareDirectorProfile } from '../netlify/lib/director-profile.mjs';

const URL = 'https://kinobazaua.com/persons/authored-director';
const ALIAS = 'Авторський режисер';
const LATIN = 'Authored Director';
const EXPECTED = { namespace: 'tmdb:person', personId: 900001, names: [LATIN] };
const tmdbData = overrides => ({ id: 900001, name: LATIN, also_known_as: [], birthday: '1967-05-20', imdb_id: 'nm9000001', external_ids: { id: 900001, imdb_id: 'nm9000001' }, ...overrides });
const person = overrides => projectTmdbPerson(tmdbData(overrides), EXPECTED);
function profile({ native = ALIAS, latin = LATIN, birthday = '20 травня 1967 (59 років)', roles = 'режисер ★8.12 (17), продюсер', extraHeader = '', extraBody = '', json, canonical = URL } = {}) {
  return `<!doctype html><html><head><link rel="canonical" href="${canonical}">${json === undefined ? '' : `<script type="application/ld+json">${typeof json === 'string' ? json : JSON.stringify(json)}</script>`}</head><body><div class="row"><div class="col-4"><img src="/authored-image.png" alt=""></div><div class="col-8"><h1 class="h2">${native}</h1><h2 class="h3 text-muted">${latin}</h2>${birthday === null ? '' : `<p><b>Дата народження:</b> ${birthday}</p>`}<p>Ролі: <a href="/authors">${roles}</a></p>${extraHeader}</div></div>${extraBody}</body></html>`;
}
const owned = overrides => ({ '@context': 'https://schema.org', '@type': 'Person', name: ALIAS, url: URL, sameAs: ['https://www.imdb.com/name/nm9000001/'], ...overrides });
async function run(options, personData) {
  const inspected = await inspectDirectorProfile(profile(options), URL, ALIAS);
  return { inspected, result: compareDirectorProfile(inspected, person(personData)) };
}

test('profile admission checks original exact HTTPS spelling and never rewrites a supplied address', () => {
  assert.equal(admitDirectorProfileURL(URL), URL);
  for (const url of [undefined, '/persons/authored-director', URL + '/', URL + '?x=1', URL + '#x', URL.replace('https:', 'http:'), URL.replace('.com/', '.com:443/'), URL.replace('/persons/', '/titles/'), URL.replace('/persons/', '/persons/a/../'), URL.replace('authored-director', 'Authored-Director'), URL.replace('authored-director', 'authored%2ddirector'), URL.replace('kinobazaua.com', 'user:pass@kinobazaua.com'), URL.replace('kinobazaua.com', 'kinobazaua.com.evil.example')]) assert.equal(admitDirectorProfileURL(url), null);
});

test('trusted TMDb projection binds exact numeric person ID and consistent root/appended IMDb IDs', () => {
  const projected = person();
  assert.equal(projected.status, 'ok'); assert.equal(projected.personId, EXPECTED.personId);
  assert.equal(projected.birthday, '1967-05-20'); assert.equal(projected.imdbId, 'nm9000001');
  assert.deepEqual(person({ also_known_as: ['Distinct Authored Name'] }).names, [LATIN, 'Distinct Authored Name']);
  for (const data of [null, [], { success: false }, { status_code: 7 }, tmdbData({ id: 900002 }), tmdbData({ id: '900001' }), tmdbData({ external_ids: { id: 900002 } }), tmdbData({ external_ids: { success: false } }), tmdbData({ external_ids: 'bad' }), tmdbData({ external_ids: { imdb_id: 'nm9000002' } }), tmdbData({ imdb_id: 'tt9000001' }), tmdbData({ birthday: '1967-02-31' }), tmdbData({ name: '' }), tmdbData({ also_known_as: 'bad' }), tmdbData({ also_known_as: ['x'.repeat(501)] })]) assert.equal(projectTmdbPerson(data, EXPECTED).status, 'unresolved');
  for (const expected of [null, { ...EXPECTED, namespace: 'imdb:person' }, { ...EXPECTED, names: [] }, { ...EXPECTED, names: ['a\u0000b'] }, { ...EXPECTED, personId: '900001' }]) assert.equal(projectTmdbPerson(tmdbData(), expected).status, 'unresolved');
});

test('own native/Latin names, full date and explicit director role form a person-level confirmation', async () => {
  const { inspected, result } = await run();
  assert.equal(inspected.status, 'ok'); assert.equal(inspected.birthday, '1967-05-20');
  assert.equal(result.status, 'confirmed'); assert.equal(result.basis, 'exact-name-birthdate-role');
  assert.deepEqual(result.aliases, [ALIAS]); assert.equal(result.provenance.personId, EXPECTED.personId);
  assert.equal(JSON.stringify(result).includes('authored-image'), false);
  // There is no film key in the person evidence: the result is reusable for
  // different films only when their trusted single-director person ID agrees.
  for (const film of [{ tmdbId: 901, directorPeople: [EXPECTED] }, { tmdbId: 902, directorPeople: [EXPECTED] }]) {
    assert.equal(compareDirectorProfile(inspected, projectTmdbPerson(tmdbData(), film.directorPeople[0])).status, 'confirmed');
  }
});

test('filmography headings and body-wide IDs do not become header names or owned person evidence', async () => {
  const { inspected, result } = await run({ extraBody: '<section><h2>Other Person</h2><p>Дата народження: 6 травня 1961</p><a href="https://www.imdb.com/name/nm9999999/">IMDb</a><a href="https://www.themoviedb.org/person/999999">TMDb</a></section>', json: { '@type': 'BreadcrumbList', itemListElement: [] } });
  assert.equal(inspected.status, 'ok'); assert.deepEqual(inspected.stableIds, []);
  assert.equal(result.status, 'confirmed'); assert.equal(result.basis, 'exact-name-birthdate-role');
});

test('shared owned same-system person ID can confirm without a common full date, not via slug or name similarity', async () => {
  for (const sameAs of [['https://www.imdb.com/name/nm9000001/'], ['https://www.themoviedb.org/person/900001-authored-director']]) {
    const { inspected, result } = await run({ birthday: null, latin: 'Different Authored Name', json: owned({ sameAs }) }, { birthday: null });
    assert.equal(inspected.status, 'ok'); assert.equal(result.status, 'confirmed'); assert.equal(result.basis, 'shared-person-id');
  }
  const unbound = await run({ birthday: null, json: owned({ url: 'https://kinobazaua.com/persons/other-director' }) });
  assert.equal(unbound.inspected.status, 'ok'); assert.equal(unbound.result.status, 'unresolved');
});

test('conflicting person IDs have priority over matching names, date and another convenient shared ID', async () => {
  for (const sameAs of [
    ['https://www.imdb.com/name/nm9000002/'],
    ['https://www.themoviedb.org/person/900002'],
    ['https://www.imdb.com/name/nm9000001/', 'https://www.themoviedb.org/person/900002'],
    ['https://www.imdb.com/name/nm9000001/', 'https://www.imdb.com/name/nm9000002/'],
  ]) {
    const { result } = await run({ json: owned({ sameAs }) });
    assert.equal(result.status, 'unresolved'); assert.match(result.reason, /id-conflict/);
    assert.equal(result.aliases, undefined);
  }
});

test('same name and differing full birthdate remain unresolved even with a shared ID', async () => {
  for (const json of [undefined, owned()]) {
    const { result } = await run({ birthday: '26 травня 1967', json });
    assert.equal(result.status, 'unresolved'); assert.equal(result.reason, 'director-person-birthday-conflict');
  }
  const semanticDOB = await run({ json: owned({ birthDate: '1967-05-26' }) });
  assert.equal(semanticDOB.inspected.reason, 'profile-birthday-conflict');
});

test('missing dates, aliases, profile role or name association cannot confirm namesakes', async () => {
  for (const options of [{ birthday: null }, { birthday: 'травень 1967' }, { birthday: '31 лютого 1967' }, { latin: 'Similar Authored Director' }, { native: 'Інша людина' }, { roles: 'актор, продюсер' }, { roles: 'помічник режисера' }]) {
    const { result } = await run(options); assert.equal(result.status, 'unresolved'); assert.equal(result.aliases, undefined);
  }
  const { result } = await run({}, { birthday: null }); assert.equal(result.status, 'unresolved');
});

test('ambiguous critical header structure refuses extra names/facts rather than choosing a convenient match', async () => {
  for (const extraHeader of ['<h1 class="h2">Інша людина</h1>', '<h2 class="h3 text-muted">Other Person</h2>', '<p>Дата народження: 20 травня 1967</p>', '<p>Ролі: режисер</p>']) {
    const { result } = await run({ extraHeader }); assert.equal(result.status, 'unresolved');
  }
  for (const html of [profile().replace('class="col-8"', 'class="unestablished"'), profile().replace('<h1 class="h2">', '<h1>'), profile().replace('<h2 class="h3 text-muted">', '<h2>'), profile().replace('<h1 class="h2">', '<div><h1 class="h2">').replace('</h1>', '</h1></div>'), profile().replace('</head>', `<link rel="canonical" href="${URL}"></head>`)]) {
    assert.equal((await inspectDirectorProfile(html, URL, ALIAS)).status, 'unresolved');
  }
  assert.equal((await run({ canonical: 'https://kinobazaua.com/persons/wrong-person' })).result.status, 'unresolved');
});

test('malformed, unowned, ambiguous and contradictory JSON-LD never become stable identity proof', async () => {
  for (const json of [
    '{bad json', owned({ '@id': 'https://unrelated.example/person' }), owned({ name: 'Unrelated Person' }),
    [owned(), owned()], owned({ sameAs: ['https://www.imdb.com/title/tt9000001/'] }),
    owned({ sameAs: Array.from({ length: 33 }, () => 'https://example.test') }), owned({ birthDate: '1967-02-31' }),
  ]) {
    const { result } = await run({ json }); assert.equal(result.status, 'unresolved');
  }
  const { result } = await run({ birthday: null, json: owned({ url: undefined, '@id': 'https://www.imdb.com/name/nm9000001/' }) });
  assert.equal(result.status, 'unresolved', 'same external ID without exact profile ownership is insufficient');
});

test('no fetches, raw bodies, scripts, source responses or arbitrary text are returned', async () => {
  const originalFetch = globalThis.fetch; let attempts = 0;
  globalThis.fetch = () => { attempts++; assert.fail('pure profile inspection must never perform HTTP'); };
  try {
    const { inspected, result } = await run({ extraBody: '<script>PRIVATE_RAW_SCRIPT</script><img src="https://private.example/token=PRIVATE_SECRET"><p>PRIVATE_RAW_RESPONSE</p><a href="https://example.test/PRIVATE_LINK">PRIVATE_SNIPPET</a>' });
    assert.equal(result.status, 'confirmed'); assert.equal(attempts, 0);
    assert.doesNotMatch(JSON.stringify({ inspected, result }), /PRIVATE_|private\.example|example\.test/);
  } finally { globalThis.fetch = originalFetch; }
});

test('noncritical malformed image attributes after header may recover, critical parse errors remain unresolved', async () => {
  const outside = profile({ extraBody: '<img src="a.png"alt="authored">' });
  const inspected = await inspectDirectorProfile(outside, URL, ALIAS);
  assert.equal(inspected.status, 'ok'); assert.equal(inspected.diagnostics.recoveredImageErrors, 1);
  const inside = profile({ extraHeader: '<img src="a.png"alt="authored">' });
  assert.equal((await inspectDirectorProfile(inside, URL, ALIAS)).reason, 'profile-html-parse-errors');
  const { result } = await run({ extraHeader: '<div a="duplicate" a="attribute"></div>' });
  assert.equal(result.status, 'unresolved');
});

test('a bounded closed style-only preamble recovers the exact three document-opening errors without rewriting HTML', async () => {
  const prefix = '<style>\n.authored-class { color: gold; }\n</style>\n\n';
  const source = prefix + profile({ extraBody: '<h2>Unrelated authored filmography heading</h2>' });
  const errors = []; parse(source, { sourceCodeLocationInfo: true, onParseError: e => errors.push(e) });
  assert.deepEqual(errors.map(e => e.code), ['missing-doctype', 'misplaced-doctype', 'misplaced-start-tag-for-head-element']);
  const inspected = await inspectDirectorProfile(source, URL, ALIAS);
  assert.equal(inspected.status, 'ok', JSON.stringify({ errors, inspected })); assert.equal(inspected.diagnostics.recoveredPreambleErrors, 3);
  assert.equal(inspected.nativeName, ALIAS); assert.equal(inspected.latinName, LATIN); assert.equal(inspected.birthday, '1967-05-20');
  assert.equal(compareDirectorProfile(inspected, person()).status, 'confirmed');
  const image = await inspectDirectorProfile(prefix + profile({ extraBody: '<img src="a.png"alt="authored">' }), URL, ALIAS);
  assert.equal(image.status, 'ok'); assert.equal(image.diagnostics.recoveredPreambleErrors, 3); assert.equal(image.diagnostics.recoveredImageErrors, 1);
});

test('preamble recovery does not accept text, scripts, ambiguous doctypes/head tags or critical markup errors', async () => {
  const prefix = '<style>\n.authored-class { color: gold; }\n</style>\n';
  for (const [index, source] of [
    'Unestablished leading text' + prefix + profile(),
    '<script>"unestablished"</script>' + profile(),
    '<style type="text/css">.authored { color: gold; }</style>' + profile(),
    '<style>.authored::before { content: "<unestablished-tag>"; }</style>' + profile(),
    '<style>.authored { color: gold; }' + profile(),
    prefix + '<!doctype html>' + profile(),
    prefix + profile().replace('<head>', '<head><head>'),
    prefix + profile({ extraHeader: '<div a="duplicate" a="attribute"></div>' }),
    prefix + profile().replace('<h1 class="h2">', '<h1 class="h2"class="unexpected">'),
  ].entries()) {
    const inspected = await inspectDirectorProfile(source, URL, ALIAS);
    assert.equal(inspected.status, 'unresolved', `Authored negative variant ${index}`); assert.equal(compareDirectorProfile(inspected, person()).status, 'unresolved');
  }
  const wrongProfile = await inspectDirectorProfile(prefix + profile({ native: 'Інший режисер' }), URL, ALIAS);
  assert.equal(wrongProfile.reason, 'profile-source-alias-conflict');
  const wrongCanonical = await inspectDirectorProfile(prefix + profile({ canonical: 'https://kinobazaua.com/persons/other-person' }), URL, ALIAS);
  assert.equal(wrongCanonical.reason, 'profile-canonical-conflict-or-ambiguous');
});

test('bounded HTML, node depth, semantic JSON and invalid arguments fail closed', async () => {
  for (const html of [null, 'x'.repeat(2 * 1024 * 1024 + 1), profile({ extraBody: '<div>'.repeat(260) + '</div>'.repeat(260) }), profile({ json: JSON.stringify({ padding: 'x'.repeat(128 * 1024) }) })]) {
    assert.equal((await inspectDirectorProfile(html, URL, ALIAS)).status, 'unresolved');
  }
  assert.equal((await inspectDirectorProfile(profile(), URL, '')).status, 'unresolved');
  assert.equal((await inspectDirectorProfile(profile(), URL + '?token=PRIVATE', ALIAS)).status, 'unresolved');
  assert.equal(compareDirectorProfile(null, person()).status, 'unresolved');
  assert.equal(compareDirectorProfile(await inspectDirectorProfile(profile(), URL, ALIAS), null).status, 'unresolved');
});
