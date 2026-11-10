// Authored film/person IDs and markup only. These cases are not reconstructed
// source responses, catalogue coverage evidence or availability assertions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAssistedKinobaza } from '../netlify/lib/kinobaza-card.mjs';
import { CARD, markup } from './assisted-kinobaza.fixture.mjs';
import { createDirectorAliasLookup } from '../shared/director-alias-crosswalk.mjs';
import { safeIdentityDiagnostic } from '../shared/media-advice-diagnostics.mjs';

const PERSON = 999999;
const film = { id: 'authored-cascade-film', tmdbId: 999900001, imdbId: 'tt999900001',
  identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2001,
  titleAliases: [], directorCount: 1, directorAliases: ['Authored director'],
  directorPeople: [{ namespace: 'tmdb:person', personId: PERSON, names: ['Authored director'] }] };
const row = (namespace = 'imdb', id = namespace === 'imdb' ? film.imdbId : String(film.tmdbId)) =>
  `<tr><td>${namespace === 'imdb' ? 'IMDb' : 'TMDb'}:</td><td>${id}</td></tr>`;
const lookup = createDirectorAliasLookup([{ namespace: 'tmdb:person', personId: PERSON,
  aliases: ['Vérified Person'], scope: 'kinobaza-director-identity',
  evidence: { source: 'Authored person profile fixture, not live evidence', reference: 'test:authored-cascade-person', verifiedAt: '2026-11-01' } }]);
const directorGates = ['director-presence', 'director-scope', 'director-alias'];

async function check({ selected = film, html = markup(), directorAliasLookup, onIdentityDiagnostic } = {}) {
  let calls = 0;
  const result = await fetchAssistedKinobaza(CARD, selected, async (url, init) => {
    calls++; assert.equal(url, CARD); assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }, { directorAliasLookup, onIdentityDiagnostic });
  assert.equal(calls, 1);
  if (result.identity?.status !== 'matched') {
    assert.deepEqual(result.candidates, []); assert.equal(result.localization, undefined);
    assert.equal(result.identity?.directorAliasEvidence, undefined);
  }
  return result;
}

for (const namespace of ['imdb', 'tmdb']) test(`cascade: scoped matching ${namespace} ID plus title/year does not require director spelling`, async () => {
  const r = await check({ html: markup({ director: 'Unknown authored spelling', stable: row(namespace) }) });
  assert.equal(r.identity.status, 'matched'); assert.equal(r.identity.reason, 'explicit-stable-title-year-match');
  assert.equal(r.identity.diagnostics.strategy, 'stable-id-title-year');
  assert.deepEqual(r.identity.diagnostics.years, { selected: 2001, source: 2001, delta: 0 });
  assert.equal(r.identity.diagnostics.comparisons.stableIdMatch, true);
  assert.equal(r.identity.diagnostics.comparisons.directorAliasMatch, false);
  for (const gate of directorGates) assert.equal(r.identity.diagnostics.gates[gate], 'not-evaluated');
  assert.equal(r.identity.directorAliasEvidence, undefined);
});

for (const [name, selected, director] of [
  ['missing source director', film, ''],
  ['missing selected director', { ...film, directorCount: null, directorAliases: [], directorPeople: [] }, 'Unknown director'],
  ['ambiguous selected director scope', { ...film, directorCount: 2, directorAliases: ['Author One', 'Author Two'], directorPeople: [] }, 'Author One / Author Two'],
]) test(`cascade: same-ID/title/year bypass has truthful skipped gates with ${name}`, async () => {
  const r = await check({ selected, html: markup({ director, stable: row() }) });
  assert.equal(r.identity.status, 'matched'); assert.equal(r.identity.reason, 'explicit-stable-title-year-match');
  for (const gate of directorGates) assert.equal(r.identity.diagnostics.gates[gate], 'not-evaluated');
});

test('cascade: a crosswalk available but unnecessary for the stable-ID route is not claimed as proof', async () => {
  const r = await check({ html: markup({ director: 'Vérified Person', stable: row() }), directorAliasLookup: lookup });
  assert.equal(r.identity.status, 'matched'); assert.equal(r.identity.directorAliasEvidence, undefined);
  assert.equal(r.identity.diagnostics.gates['director-alias'], 'not-evaluated');
});

test('cascade: agreeing IMDb and TMDb IDs retain same-namespace comparison', async () => {
  const r = await check({ html: markup({ director: '', stable: row() + row('tmdb') }) });
  assert.equal(r.identity.status, 'matched'); assert.equal(r.identity.diagnostics.comparisons.stableIdConflict, false);
});

for (const [name, stable] of [
  ['agreeing IMDb and conflicting TMDb', row() + row('tmdb', '999900002')],
  ['agreeing TMDb and conflicting IMDb', row('tmdb') + row('imdb', 'tt999900002')],
  ['two different IMDb literals', row() + row('imdb', 'tt999900002')],
  ['conflict preceding malformed evidence and title/year mismatch', row('imdb', 'tt999900002') + row('tmdb', 'invalid')],
]) test(`cascade: ${name} cannot become a match`, async () => {
  const r = await check({ html: markup({ title: 'Conflicting title', year: 2008, director: 'Unknown director', stable }) });
  assert.equal(r.identity.status, 'mismatch'); assert.equal(r.identity.reason, 'source-stable-id-conflict');
  assert.equal(r.identity.diagnostics.failedGate, 'stable-id-conflict');
  assert.equal(r.identity.diagnostics.gates['heading-alias'], 'not-evaluated');
});

test('cascade: a malformed explicit ID is not hidden by an agreeing ID in the other namespace', async () => {
  const r = await check({ html: markup({ stable: row() + row('tmdb', 'invalid') }) });
  assert.equal(r.identity.status, 'unresolved'); assert.equal(r.identity.reason, 'malformed-source-stable-id');
});

test('cascade: a source TMDb ID cannot be compared to the selected IMDb numeric suffix', async () => {
  const r = await check({ selected: { ...film, tmdbId: 999900002 }, html: markup({ stable: row('tmdb', '999900001') }) });
  assert.equal(r.identity.status, 'mismatch'); assert.equal(r.identity.reason, 'source-stable-id-conflict');
  assert.equal(r.identity.diagnostics.comparisons.stableIdMatch, false);
});

for (const [name, changes, status, reason] of [
  ['conflicting heading', { title: 'A different authored film' }, 'mismatch', 'source-title-conflict'],
  ['unestablished original title', { original: 'A different original title' }, 'unresolved', 'source-original-title-unestablished'],
]) test(`cascade: stable ID does not bypass ${name}`, async () => {
  const r = await check({ html: markup({ ...changes, stable: row() }) });
  assert.equal(r.identity.status, status); assert.equal(r.identity.reason, reason);
});

test('cascade: agreeing stable ID does not resolve competing original-title headings', async () => {
  const html = markup({ stable: row() }).replace('<h2>Authored original</h2>', '<h2>Authored original</h2><h2>Other original</h2>');
  const r = await check({ html });
  assert.equal(r.identity.status, 'unresolved'); assert.equal(r.identity.reason, 'source-original-title-scope-unestablished');
});

test('cascade: differing year with stable ID requires director proof and records the variance', async () => {
  let local;
  const r = await check({ html: markup({ year: 2002, stable: row() }), onIdentityDiagnostic: d => { local = d; } });
  assert.equal(r.identity.status, 'matched'); assert.equal(r.identity.reason, 'explicit-stable-and-structural-match');
  assert.equal(r.identity.diagnostics.strategy, 'stable-id-title-director-year-variance');
  assert.deepEqual(r.identity.diagnostics.years, { selected: 2001, source: 2002, delta: 1 });
  assert.equal(r.identity.diagnostics.comparisons.yearEqual, false);
  for (const gate of directorGates) assert.equal(r.identity.diagnostics.gates[gate], 'pass');
  assert.equal(local.sourceIdentity.year, 2002); assert.equal(local.expected.year, 2001);
});

test('cascade: person-scoped reviewed alias can corroborate a different film year without fuzzy matching', async () => {
  const r = await check({ html: markup({ year: 2000, stable: row(), director: 'Vérified Person' }), directorAliasLookup: lookup });
  assert.equal(r.identity.status, 'matched'); assert.equal(r.identity.reason, 'explicit-stable-and-structural-match');
  assert.deepEqual(r.identity.diagnostics.years, { selected: 2001, source: 2000, delta: -1 });
  assert.equal(r.identity.directorAliasEvidence.personId, PERSON);
});

for (const [name, selected, director, reason] of [
  ['missing director', film, '', 'source-or-selected-director-missing'],
  ['different director spelling', film, 'Authored Directór', 'director-alias-unestablished'],
  ['ambiguous director scope', { ...film, directorCount: 2 }, 'Authored director', 'director-scope-unestablished'],
]) test(`cascade: stable ID with different year cannot bypass ${name}`, async () => {
  const r = await check({ selected, html: markup({ year: 2002, stable: row(), director }) });
  assert.equal(r.identity.status, 'unresolved'); assert.equal(r.identity.reason, reason);
  assert.deepEqual(r.identity.diagnostics.years, { selected: 2001, source: 2002, delta: 1 });
});

test('cascade: without a shared ID title/year/director remain required', async () => {
  const r = await check();
  assert.equal(r.identity.status, 'matched'); assert.equal(r.identity.reason, 'explicit-title-year-director-match');
  assert.equal(r.identity.diagnostics.strategy, 'title-year-director');
  assert.equal(r.identity.diagnostics.comparisons.stableIdMatch, false);
  assert.equal(r.identity.diagnostics.gates['director-alias'], 'pass');
});

test('cascade: without an ID a different year remains a conflict despite an exact director', async () => {
  const r = await check({ html: markup({ year: 2002 }) });
  assert.equal(r.identity.status, 'mismatch'); assert.equal(r.identity.reason, 'source-year-conflict-without-stable-crosswalk');
});

for (const [name, selected, director] of [
  ['a similar but unverified name', film, 'Authored Directór'],
  ['an alias owned by another person ID', { ...film, directorPeople: [{ ...film.directorPeople[0], personId: PERSON + 1 }] }, 'Vérified Person'],
]) test(`cascade: no-ID route with ${name} remains unresolved`, async () => {
  const r = await check({ selected, html: markup({ director }), directorAliasLookup: lookup });
  assert.equal(r.identity.status, 'unresolved'); assert.equal(r.identity.reason, 'director-alias-unestablished');
});

test('cascade: a matching ID after the viewing boundary cannot authorize director bypass', async () => {
  const html = markup({ director: 'Unknown director' }).replace('</body>', `<table>${row()}</table></body>`);
  const r = await check({ html });
  assert.equal(r.identity.status, 'unresolved'); assert.equal(r.identity.reason, 'director-alias-unestablished');
  assert.equal(r.identity.diagnostics.comparisons.stableIdMatch, false);
  assert.equal(r.identity.observed.stableIdCount, 1);
});

test('cascade: an explicit conflicting labelled ID retains fail-closed priority outside the positive evidence scope', async () => {
  const html = markup().replace('</body>', `<table>${row('imdb', 'tt999900002')}</table></body>`);
  const r = await check({ html });
  assert.equal(r.identity.status, 'mismatch'); assert.equal(r.identity.reason, 'source-stable-id-conflict');
  assert.equal(r.identity.diagnostics.comparisons.stableIdMatch, false);
});

test('cascade: matching ID before the film heading is not authority', async () => {
  const html = markup({ director: 'Unknown director' }).replace('<body>', `<body><table>${row()}</table>`);
  const r = await check({ html });
  assert.equal(r.identity.status, 'unresolved'); assert.equal(r.identity.diagnostics.comparisons.stableIdMatch, false);
});

for (const tag of ['nav', 'aside', 'footer']) test(`cascade: ${tag} metadata cannot authorize or conflict with the film`, async () => {
  const html = markup().replace('</h2>', `</h2><${tag}><table>${row('imdb', 'tt999900002')}</table></${tag}>`);
  const r = await check({ html });
  assert.equal(r.identity.status, 'matched'); assert.equal(r.identity.observed.stableIdCount, 0);
});

test('cascade: an enclosing table beginning before H1 does not establish film-metadata ownership', async () => {
  const start = '<h1>Вигаданий фільм (2001)</h1><h2>Authored original</h2><table>';
  const html = markup({ director: 'Unknown director', stable: row() }).replace(start,
    '<table><tr><td><h1>Вигаданий фільм (2001)</h1><h2>Authored original</h2></td></tr>');
  const r = await check({ html });
  assert.notEqual(r.identity.status, 'matched'); assert.equal(r.identity.diagnostics.comparisons.stableIdMatch, false);
  assert.equal(r.identity.observed.stableIdCount, 1);
});

test('cascade: a table spanning the viewing boundary is not authority for a film ID', async () => {
  const html = `<!doctype html><html><head><link rel="canonical" href="${CARD}"></head><body><h1>Вигаданий фільм (2001)</h1><h2>Authored original</h2><table>${row()}<tr><td>Режисер:</td><td>Unknown director</td></tr><tr><td colspan="2"><div id="availabilityAccordion"></div></td></tr></table></body></html>`;
  const r = await check({ html });
  assert.notEqual(r.identity.status, 'matched'); assert.equal(r.identity.diagnostics.comparisons.stableIdMatch, false);
  assert.equal(r.identity.observed.stableIdCount, 1);
});

test('cascade: adjacent metadata table remains within exclusive H1/accordion offsets', async () => {
  const html = `<!doctype html><html><head><link rel="canonical" href="${CARD}"></head><body><h1>Вигаданий фільм (2001)</h1><table><tr><td><h2>Authored original</h2></td></tr>${row()}<tr><td>Режисер:</td><td>Unknown authored spelling</td></tr></table><div id="availabilityAccordion"></div></body></html>`;
  const r = await check({ html });
  assert.equal(r.identity.status, 'matched');
  assert.equal(r.identity.reason, 'explicit-stable-title-year-match');
});

test('cascade: matching ID cannot turn an invalid or unknown year into agreement', async () => {
  for (const sourceYear of ['0000', '0999']) {
    const r = await check({ html: markup({ year: sourceYear, stable: row() }) });
    assert.equal(r.identity.status, 'unresolved'); assert.equal(r.identity.reason, 'source-title-year-missing');
  }
  const r = await check({ selected: { ...film, year: null }, html: markup({ stable: row() }) });
  assert.equal(r.identity.status, 'unresolved'); assert.equal(r.identity.reason, 'selected-year-missing');
});

for (const strategy of ['stable-id-title-year', 'stable-id-title-director-year-variance', 'title-year-director']) test(`cascade diagnostics: ${strategy} survives the content-free allowlist`, () => {
  const d = safeIdentityDiagnostic({ strategy, years: { selected: 2001, source: 2002, delta: 1 } });
  assert.equal(d.strategy, strategy); assert.deepEqual(d.years, { selected: 2001, source: 2002, delta: 1 });
});

test('cascade diagnostics: malicious strategy, malformed years and raw evidence cannot leak', () => {
  const d = safeIdentityDiagnostic({ strategy: 'PRIVATE_SECRET', years: { selected: 'PRIVATE_YEAR', source: '2002', delta: Infinity, raw: 'PRIVATE_BODY' }, sourceURL: CARD, html: 'PRIVATE_HTML' });
  assert.equal(d.strategy, null); assert.deepEqual(d.years, { selected: null, source: null, delta: null });
  assert.doesNotMatch(JSON.stringify(d), /PRIVATE|https?:|sourceURL|html|raw/);
});
