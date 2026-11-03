// Authored structural regressions, not saved or reconstructed Kinobaza HTML.
// The familiar names label the regression; the person IDs/evidence are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'parse5';
import { inspectDirectorProfile, projectTmdbPerson, compareDirectorProfile } from '../netlify/lib/director-profile.mjs';

const URL = 'https://kinobazaua.com/persons/authored-plot-director';
const NATIVE = 'Пол Макґіґан';
const LATIN = 'Paul McGuigan';
const EXPECTED = { namespace: 'tmdb:person', personId: 990001, names: [LATIN] };
const PREAMBLE = '<style>\n.authored-person { color: gold; }\n</style>\n';
const MALFORMED = '<a href="/titles/authored-film"<br />Authored film title</a>';
const plot = (anchor = MALFORMED, { parent = 'em', className = 'nobr', detailsClass = 'js-plot', closed = true } = {}) =>
  `<details class="${detailsClass}"><summary>Сюжет</summary>Authored synopsis <${parent} class="${className}">${anchor}</${parent}>${closed ? '</details>' : ''}`;
const owned = overrides => ({ '@context': 'https://schema.org', '@type': 'Person', name: NATIVE, url: URL, sameAs: ['https://www.themoviedb.org/person/990001'], ...overrides });

function profile({ body = '', header = '', prefix = '', json, native = NATIVE, latin = LATIN, birthday = '19 вересня 1963', roles = 'режисер ★7.00 (1), продюсер' } = {}) {
  return `${prefix}<!doctype html><html><head><link rel="canonical" href="${URL}">${json === undefined ? '' : `<script type="application/ld+json">${typeof json === 'string' ? json : JSON.stringify(json)}</script>`}</head><body><div class="row"><div class="col-4"><img src="/authored-profile.png" alt=""></div><div class="col-8"><h1 class="h2">${native}</h1><h2 class="h3 text-muted">${latin}</h2>${birthday === null ? '' : `<p>Дата народження: ${birthday}</p>`}<p>Ролі: ${roles}</p>${header}</div></div>${body}</body></html>`;
}
function person(overrides = {}) {
  return projectTmdbPerson({ id: 990001, name: LATIN, also_known_as: [], birthday: '1963-09-19', external_ids: {}, ...overrides }, EXPECTED);
}
async function inspect(options = {}) {
  return inspectDirectorProfile(profile(options), URL, NATIVE);
}
function parseErrors(html) {
  const errors = [];
  parse(html, { sourceCodeLocationInfo: true, onParseError: error => errors.push(error) });
  return errors;
}

test('authored repeated desktop/mobile plot anchors recover only the located three-error batch per anchor', async () => {
  const html = profile({ body: `<section class="desktop">${plot()}</section><section class="mobile">${plot()}</section>` });
  const errors = parseErrors(html);
  assert.deepEqual(errors.map(error => error.code), [
    'missing-whitespace-between-attributes', 'unexpected-character-in-attribute-name', 'non-void-html-element-start-tag-with-trailing-solidus',
    'missing-whitespace-between-attributes', 'unexpected-character-in-attribute-name', 'non-void-html-element-start-tag-with-trailing-solidus',
  ]);
  const inspected = await inspectDirectorProfile(html, URL, NATIVE);
  assert.equal(inspected.status, 'ok', JSON.stringify(inspected));
  assert.equal(inspected.diagnostics.recoveredPlotErrors, 6);
  assert.equal(inspected.diagnostics.recoveredPreambleErrors, 0);
  assert.equal(inspected.diagnostics.recoveredImageErrors, 0);
  assert.equal(inspected.nativeName, NATIVE);
  assert.equal(inspected.latinName, LATIN);
  assert.equal(inspected.birthday, '1963-09-19');
  const comparison = compareDirectorProfile(inspected, person());
  assert.equal(comparison.status, 'confirmed');
  assert.equal(comparison.basis, 'exact-name-birthdate-role');
  assert.equal(comparison.provenance.personId, EXPECTED.personId);
  assert.deepEqual(comparison.aliases, [NATIVE]);
  assert.equal(comparison.diagnostics.recoveredPlotErrors, 6);
});

test('plot recovery composes with the exact existing style preamble and bounded image recovery', async () => {
  for (const prefix of ['', PREAMBLE]) {
    for (const image of ['', '<img src="/authored-cover.png"alt="authored">']) {
      const inspected = await inspect({ prefix, body: plot() + plot() + image });
      assert.equal(inspected.status, 'ok', JSON.stringify(inspected));
      assert.equal(inspected.diagnostics.recoveredPlotErrors, 6);
      assert.equal(inspected.diagnostics.recoveredPreambleErrors, prefix ? 3 : 0);
      assert.equal(inspected.diagnostics.recoveredImageErrors, image ? 1 : 0);
      assert.equal(compareDirectorProfile(inspected, person()).status, 'confirmed');
    }
  }
});

test('well-formed plot links do not need recovery or become person-ID evidence', async () => {
  const inspected = await inspect({ body: plot('<a href="https://www.themoviedb.org/person/990002">Another person in a synopsis</a>') });
  assert.equal(inspected.status, 'ok');
  assert.equal(inspected.diagnostics.recoveredPlotErrors, 0);
  assert.deepEqual(inspected.stableIds, []);
  assert.equal(compareDirectorProfile(inspected, person()).status, 'confirmed');
});

test('malformed anchors in the identity header, outside a plot or without the exact parent scope fail closed', async () => {
  const cases = [
    { header: plot() },
    { header: `<em class="nobr">${MALFORMED}</em>` },
    { body: `<em class="nobr">${MALFORMED}</em>` },
    { body: `<section class="js-plot"><em class="nobr">${MALFORMED}</em></section>` },
    { body: plot(MALFORMED, { detailsClass: 'other-plot' }) },
    { body: plot(MALFORMED, { parent: 'span' }) },
    { body: plot(MALFORMED, { className: 'other-text' }) },
    { body: plot(`<span>${MALFORMED}</span>`) },
    { body: `<details class="js-plot"><p><em class="nobr">${MALFORMED}</em></p></details>` },
    { body: plot(MALFORMED, { closed: false }) },
  ];
  for (const [index, options] of cases.entries()) {
    const inspected = await inspect(options);
    assert.equal(inspected.status, 'unresolved', `authored scope variant ${index}`);
    assert.equal(inspected.reason, 'profile-html-parse-errors', `authored scope variant ${index}`);
    assert.equal(compareDirectorProfile(inspected, person()).status, 'unresolved');
  }
});

test('missing explicit anchor end tags, nested children and altered malformed attributes are not the accepted pattern', async () => {
  for (const [index, anchor] of [
    '<a href="/titles/authored-film"<br />Authored film title',
    '<a href="/titles/authored-film"<br /><span>Authored film title</span></a>',
    '<a href="/titles/authored-film"<br /><img src="/authored.png" alt=""></a>',
    '<a href="/titles/authored-film" class="extra"<br />Authored film title</a>',
    '<a href="/titles/authored-film"<br data-extra="unestablished" />Authored film title</a>',
    '<a href="/titles/authored-film"<hr />Authored film title</a>',
    '<a href="/titles/authored-film"<br>Authored film title</a>',
    '<a href="/titles/authored-film"href="/titles/other-film"<br />Authored film title</a>',
  ].entries()) {
    const inspected = await inspect({ body: plot(anchor) });
    assert.equal(inspected.status, 'unresolved', `authored anchor variant ${index}`);
    assert.equal(inspected.reason, 'profile-html-parse-errors', `authored anchor variant ${index}`);
  }
});

test('a recoverable plot never masks unrelated parser errors or ambiguous critical identity structure', async () => {
  for (const [index, options] of [
    { body: plot() + '<div data-a="one" data-a="two"></div>' },
    { body: plot(), header: '<div data-a="one" data-a="two"></div>' },
    { body: plot(), prefix: '<script>"unestablished"</script>' },
    { body: plot(), header: '<h2 class="h3 text-muted">Another Person</h2>' },
    { body: plot(), header: '<p>Дата народження: 20 вересня 1963</p>' },
    { body: plot(), header: '<p>Ролі: режисер</p>' },
    { body: plot(), native: 'Інша людина' },
    { body: plot(), roles: 'актор, продюсер' },
    { body: plot(), json: '{invalid semantic JSON' },
    { body: plot(), json: [owned(), owned()] },
  ].entries()) {
    const inspected = await inspect(options);
    assert.equal(inspected.status, 'unresolved', `authored critical variant ${index}`);
    assert.equal(compareDirectorProfile(inspected, person()).status, 'unresolved');
  }
});

test('recovered plot syntax does not weaken full-date, exact-name, stable-ID or source-alias comparisons', async () => {
  const good = await inspect({ body: plot() });
  assert.equal(good.status, 'ok');
  for (const [index, other] of [
    person({ birthday: '1963-09-20' }),
    person({ birthday: null }),
    projectTmdbPerson({ id: 990002, name: 'Paul McGuigan Jr', also_known_as: [], birthday: '1963-09-19', external_ids: {} }, { namespace: 'tmdb:person', personId: 990002, names: ['Paul McGuigan Jr'] }),
  ].entries()) {
    assert.equal(compareDirectorProfile(good, other).status, 'unresolved', `authored person variant ${index}`);
  }
  const idConflict = await inspect({ body: plot(), json: owned({ sameAs: ['https://www.themoviedb.org/person/990002'] }) });
  assert.equal(idConflict.status, 'ok');
  assert.equal(compareDirectorProfile(idConflict, person()).reason, 'director-person-id-conflict');
  const dobConflict = await inspect({ body: plot(), json: owned({ birthDate: '1963-09-20' }) });
  assert.equal(dobConflict.reason, 'profile-birthday-conflict');
  assert.equal((await inspectDirectorProfile(profile({ body: plot() }), URL, 'Непов’язаний режисер')).reason, 'profile-source-alias-conflict');
});

test('plot recovery stays pure and returns neither synopsis URLs nor arbitrary source text', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls++; assert.fail('profile inspection cannot perform HTTP'); };
  try {
    const inspected = await inspect({ body: plot('<a href="/titles/private-authored-body"<br />PRIVATE_AUTHORED_PLOT</a>') });
    assert.equal(inspected.status, 'ok');
    assert.equal(compareDirectorProfile(inspected, person()).status, 'confirmed');
    assert.equal(calls, 0);
    assert.doesNotMatch(JSON.stringify(inspected), /private-authored-body|PRIVATE_AUTHORED_PLOT/);
  } finally { globalThis.fetch = originalFetch; }
});

test('recoverable plot batches cannot bypass the total parser-error limit', async () => {
  const inspected = await inspect({ body: plot().repeat(34) });
  assert.equal(inspected.status, 'unresolved');
  assert.equal(inspected.reason, 'profile-html-error-limit');
});

test('a malformed plot href never supplies an owned person ID', async () => {
  const inspected = await inspect({ body: plot('<a href="https://www.themoviedb.org/person/990002"<br />Other person</a>') });
  assert.equal(inspected.status, 'ok');
  assert.deepEqual(inspected.stableIds, []);
  assert.equal(compareDirectorProfile(inspected, person()).basis, 'exact-name-birthdate-role');
});

test('a full birthdate mentioned in a plot cannot fill the missing header date', async () => {
  const inspected = await inspect({ birthday: null, body: plot('<a href="/titles/authored"<br />Дата народження: 19 вересня 1963</a>') });
  assert.equal(inspected.status, 'ok');
  assert.equal(inspected.birthday, null);
  assert.equal(compareDirectorProfile(inspected, person()).reason, 'director-person-evidence-insufficient');
});
