// Authored fictional films, IDs and HTML only. These are not captured source
// responses, historical-pilot reconstructions or availability assertions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sameTerminalRomanTitle } from '../shared/terminal-roman-title.mjs';
import { fetchAssistedKinobaza } from '../netlify/lib/kinobaza-card.mjs';
import { markup, CARD } from './assisted-kinobaza.fixture.mjs';
import { netflixAudioCatalogueBlock } from './kinobaza-localization.fixture.mjs';
import { composeDiscovery } from '../research/grounded-answer-demo/discovery.mjs';
import { productMediaResult } from '../netlify/lib/media-advice-response.mjs';
import { presentMediaGroups } from '../assets/media-advice-presentation.mjs';
import { linkChoicesFor, makePreview } from '../assets/media-advice.mjs';
import { createDirectorAliasLookup } from '../shared/director-alias-crosswalk.mjs';
import { safeIdentityDiagnostic } from '../shared/media-advice-diagnostics.mjs';
import { safeMediaReport } from '../assets/media-advice-report.mjs';

const film = { id: 'imdb:tt999900001', imdbId: 'tt999900001', tmdbId: 999900001,
  identityTitle: 'Авторська пригода II', originalTitle: 'Authored Adventure II', year: 2001,
  titleAliases: [], directorAliases: ['Authored Director'], directorCount: 1,
  directorPeople: [{ namespace: 'tmdb:person', personId: 999999, names: ['Authored Director'] }] };
const idRow = (namespace = 'imdb', id = namespace === 'imdb' ? film.imdbId : film.tmdbId) =>
  `<tr><td>${namespace === 'imdb' ? 'IMDb' : 'TMDb'}:</td><td>${id}</td></tr>`;
const filmLink = 'https://www.netflix.com/title/900009999?exact=%2f#AuthorOnly';
const sourceMarkup = (options = {}) => markup({ title: 'Авторська пригода ІІ', original: film.originalTitle,
  year: film.year, director: 'Authored Director', ...options });

async function card({ selected = film, html = sourceMarkup(), directorAliasLookup } = {}) {
  let calls = 0;
  const result = await fetchAssistedKinobaza(CARD, selected, async (url, init) => {
    calls++; assert.equal(url, CARD); assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }, { directorAliasLookup });
  assert.equal(calls, 1, 'title comparison cannot introduce another request');
  if (result.identity?.status !== 'matched') {
    assert.deepEqual(result.candidates, []); assert.equal(result.localization, undefined);
  }
  return result;
}

for (const [latin, source] of [['II', 'ІІ'], ['III', 'IІІ'], ['IV', 'ІV'], ['VI', 'VІ'], ['IX', 'ІX'], ['XIV', 'XІV']]) {
  test(`terminal Roman helper: ${latin} and ${source} share only the bounded suffix`, () => {
    assert.equal(sameTerminalRomanTitle(`Авторська пригода ${latin}`, `Авторська пригода ${source}`), true);
    assert.equal(sameTerminalRomanTitle(`Авторська пригода ${source}`, `Авторська пригода ${latin}`), true);
  });
  test(`identity: terminal ${source} accepts exact original/year/director for ${latin}`, async () => {
    const selected = { ...film, identityTitle: `Авторська пригода ${latin}`, originalTitle: `Authored Adventure ${latin}` };
    const r = await card({ selected, html: sourceMarkup({ title: `Авторська пригода ${source}`, original: selected.originalTitle }) });
    assert.equal(r.identity.status, 'matched');
    assert.equal(r.identity.diagnostics.strategy, 'title-terminal-roman-year-director');
    assert.equal(r.identity.diagnostics.gates['director-alias'], 'pass');
    assert.equal(r.identity.diagnostics.comparisons.originalAliasMatch, true);
  });
}

for (const [name, left, right] of [
  ['different part', 'Авторська пригода II', 'Авторська пригода ІІІ'],
  ['different ordered numeral', 'Авторська пригода VI', 'Авторська пригода ІV'],
  ['different base', 'Авторська пригода II', 'Інша пригода ІІ'],
  ['cross-script letter in base', 'Інший фільм II', 'Iнший фільм ІІ'],
  ['attached token', 'Авторська пригодаII', 'Авторська пригодаІІ'],
  ['nonterminal token', 'Авторська II: продовження', 'Авторська ІІ: продовження'],
  ['lowercase cross-script token', 'Авторська пригода ii', 'Авторська пригода іі'],
  ['Unicode Roman number', 'Авторська пригода II', 'Авторська пригода Ⅱ'],
  ['Arabic number', 'Авторська пригода II', 'Авторська пригода 2'],
  ['malformed canonical numeral', 'Авторська пригода IIII', 'Авторська пригода ІІІІ'],
  ['Cyrillic X is not allowed', 'Авторська пригода XI', 'Авторська пригода ХІ'],
  ['Cyrillic C is not allowed', 'Авторська пригода CI', 'Авторська пригода СІ'],
  ['Cyrillic M is not allowed', 'Авторська пригода MI', 'Авторська пригода МІ'],
  ['single letter is deliberately outside fallback', 'Авторська пригода I', 'Авторська пригода І'],
  ['no substantive title', 'II', 'ІІ'],
  ['no numeral', 'Авторська пригода', 'Авторська пригода'],
  ['missing value', null, 'Авторська пригода ІІ'],
  ['non-string value', 2, 'Авторська пригода ІІ'],
]) test(`terminal Roman helper rejects ${name}`, () => {
  assert.equal(sameTerminalRomanTitle(left, right), false);
});

for (const namespace of ['imdb', 'tmdb']) {
  test(`identity: matching ${namespace} ID does not bypass director on Roman fallback`, async () => {
    const matched = await card({ html: sourceMarkup({ stable: idRow(namespace) }) });
    assert.equal(matched.identity.status, 'matched');
    assert.equal(matched.identity.diagnostics.strategy, 'title-terminal-roman-year-director');
    assert.equal(matched.identity.diagnostics.comparisons.stableIdMatch, true);
    assert.equal(matched.identity.diagnostics.gates['director-alias'], 'pass');
    const unresolved = await card({ html: sourceMarkup({ stable: idRow(namespace), director: 'Unknown authored spelling' }) });
    assert.equal(unresolved.identity.status, 'unresolved');
    assert.equal(unresolved.identity.reason, 'director-alias-unestablished');
  });
  test(`identity: conflicting ${namespace} ID retains precedence over Roman title`, async () => {
    const r = await card({ html: sourceMarkup({ stable: idRow(namespace, namespace === 'imdb' ? 'tt999900002' : 999900002), director: 'Unknown authored spelling' }) });
    assert.equal(r.identity.status, 'mismatch'); assert.equal(r.identity.reason, 'source-stable-id-conflict');
    assert.equal(r.identity.diagnostics.gates['heading-alias'], 'not-evaluated');
  });
}

for (const [name, original] of [
  ['Roman folding is not applied to H2', 'Authored Adventure ІІ'],
  ['another part in H2', 'Authored Adventure III'],
  ['another original title', 'Another Authored Original II'],
]) test(`identity: ${name} remains withheld even with matching stable ID`, async () => {
  const r = await card({ html: sourceMarkup({ original, stable: idRow() }) });
  assert.equal(r.identity.status, 'unresolved'); assert.equal(r.identity.reason, 'source-original-title-unestablished');
});

for (const [name, selected, stable] of [
  ['without stable ID', film, ''],
  ['with stable ID', film, idRow()],
  ['with known premiere year', { ...film, identityContext: { tmdbId: film.tmdbId,
    releaseEvidence: [{ date: '2000-09-09T00:00:00.000Z', year: 2000, type: 1, country: 'CA' }] } }, ''],
  ['with stable ID and known premiere year', { ...film, identityContext: { tmdbId: film.tmdbId,
    releaseEvidence: [{ date: '2000-09-09T00:00:00.000Z', year: 2000, type: 1, country: 'CA' }] } }, idRow()],
]) test(`identity: Roman fallback requires same primary year ${name}`, async () => {
  const r = await card({ selected, html: sourceMarkup({ year: 2000, stable }) });
  assert.equal(r.identity.status, 'mismatch'); assert.equal(r.identity.reason, 'source-year-conflict-terminal-roman-title');
});

for (const [name, selected, director, reason] of [
  ['missing source director', film, '', 'source-or-selected-director-missing'],
  ['unverified source director', film, 'Another Authored Director', 'director-alias-unestablished'],
  ['missing selected director', { ...film, directorAliases: [] }, 'Authored Director', 'source-or-selected-director-missing'],
  ['multiple selected directors', { ...film, directorCount: 2 }, 'Authored Director', 'director-scope-unestablished'],
  ['multiple source directors', film, 'Authored Director / Another Authored Director', 'director-alias-unestablished'],
]) test(`identity: Roman fallback preserves ${name} withholding despite matching stable ID`, async () => {
  const r = await card({ selected, html: sourceMarkup({ director, stable: idRow() }) });
  assert.equal(r.identity.status, 'unresolved'); assert.equal(r.identity.reason, reason);
});

test('identity: two distinct labelled source directors remain an ambiguous scope on Roman fallback', async () => {
  const r = await card({ html: sourceMarkup({ stable: idRow() + '<tr><td>Режисер:</td><td>Another Authored Director</td></tr>' }) });
  assert.equal(r.identity.status, 'unresolved'); assert.equal(r.identity.reason, 'director-scope-unestablished');
  assert.equal(r.identity.diagnostics.counts.directorCount, 2);
});

for (const [name, html, status, reason] of [
  ['canonical conflict', sourceMarkup({ url: 'https://kinobazaua.com/titles/another-authored-film' }), 'mismatch', 'source-canonical-conflict'],
  ['malformed ID', sourceMarkup({ stable: idRow('imdb', 'not-an-id') }), 'unresolved', 'malformed-source-stable-id'],
  ['ambiguous original headings', sourceMarkup().replace('<h2>Authored Adventure II</h2>', '<h2>Authored Adventure II</h2><h2>Another Original</h2>'), 'unresolved', 'source-original-title-scope-unestablished'],
]) test(`identity: Roman fallback does not bypass ${name}`, async () => {
  const r = await card({ html });
  assert.equal(r.identity.status, status); assert.equal(r.identity.reason, reason);
});

test('identity: reviewed person-scoped alias remains usable for the Roman route without moving to another person', async () => {
  const lookup = createDirectorAliasLookup([{ namespace: 'tmdb:person', personId: 999999,
    aliases: ['Авторський режисер'], scope: 'kinobaza-director-identity',
    evidence: { source: 'Authored person fixture; not live evidence', reference: 'test:terminal-roman-person', verifiedAt: '2026-11-02' } }]);
  const html = sourceMarkup({ director: 'Авторський режисер' });
  const matched = await card({ html, directorAliasLookup: lookup });
  assert.equal(matched.identity.status, 'matched'); assert.equal(matched.identity.directorAliasEvidence.personId, 999999);
  const other = await card({ html, selected: { ...film,
    directorPeople: [{ ...film.directorPeople[0], personId: 999998 }] }, directorAliasLookup: lookup });
  assert.equal(other.identity.status, 'unresolved'); assert.equal(other.identity.reason, 'director-alias-unestablished');
});

test('identity: another film base or another sequel is not rescued by matching original/year/director', async () => {
  for (const title of ['Інша пригода ІІ', 'Авторська пригода ІІІ', 'Авторська прiгода ІІ']) {
    const r = await card({ html: sourceMarkup({ title, stable: idRow() }) });
    assert.equal(r.identity.status, 'mismatch'); assert.equal(r.identity.reason, 'source-title-conflict');
  }
});

test('identity: exact-title stable-ID cascade is unchanged and can still skip director spelling', async () => {
  const r = await card({ html: sourceMarkup({ title: film.identityTitle, stable: idRow(), director: 'Unknown authored spelling' }) });
  assert.equal(r.identity.status, 'matched'); assert.equal(r.identity.reason, 'explicit-stable-title-year-match');
  assert.equal(r.identity.diagnostics.strategy, 'stable-id-title-year');
  assert.equal(r.identity.diagnostics.gates['director-alias'], 'not-evaluated');
});

test('Roman title route reaches language comparison, exact link and local preview for ordinary and diagnostic Beta users', async () => {
  const extracted = await card({ html: sourceMarkup({ blocks: netflixAudioCatalogueBlock({ href: filmLink }) }) });
  assert.equal(extracted.identity.status, 'matched');
  const diagnostics = safeIdentityDiagnostic(extracted.identity.diagnostics);
  assert.equal(diagnostics.strategy, 'title-terminal-roman-year-director');
  assert.equal(diagnostics.gates['heading-alias'], 'pass'); assert.equal(diagnostics.gates['director-alias'], 'pass');
  const result = composeDiscovery(film, { tmdb: { result: null }, motn: { result: null },
    kinobaza: { status: extracted.status, result: extracted } });
  const before = JSON.stringify(result);
  for (const authorized of [false, true]) {
    const capabilities = { mykola_media_advice: true, mykola_media_advice_diagnostics: authorized };
    const response = authorized ? { ...result, capabilities } : productMediaResult(result, capabilities);
    const info = presentMediaGroups(response.rows, { filmId: film.id }).find(info => info.group.key === 'netflix');
    assert.ok(info); assert.equal(info.band, 'ua-audio');
    assert.equal(info.comparison.availability.symbol, '◐'); assert.equal(info.comparison.audio.symbol, '+');
    assert.equal(info.comparison.subtitles.symbol, '+');
    const choices = linkChoicesFor(info); assert.equal(choices.length, 1); assert.equal(choices[0].href, filmLink);
    const fields = { recommended_medium: 'DVD', purchase_url: 'https://example.com/authored-manual' };
    const preview = makePreview(choices[0].row, fields);
    assert.equal(preview.after.recommended_medium, 'Netflix'); assert.equal(preview.after.purchase_url, filmLink);
    assert.deepEqual(fields, { recommended_medium: 'DVD', purchase_url: 'https://example.com/authored-manual' }, 'preview performs no local apply or Save');
    if (!authorized) assert.doesNotMatch(JSON.stringify(response), /title-terminal-roman-year-director|Authored Director|directorAliasEvidence/);
  }
  assert.equal(JSON.stringify(result), before, 'presentation/projection do not mutate original source rows');
  assert.match(safeMediaReport({ ...result, resolver: { cards: [{ identity: 'matched', diagnostics }] } }), /Identity route title-terminal-roman-year-director/);
});
