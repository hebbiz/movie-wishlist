// Characterization only: authored observations, not Lucky Number Slevin HTML
// or a reconstruction of its historical Tavily/profile response. No HTTP.
// The current mixed-case heading is intentionally documented, not changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { possibleIrrelevantSearch } from '../shared/media-search-relevance-diagnostic.mjs';
import { safeMediaReport } from '../assets/media-advice-report.mjs';
import { productMediaResult } from '../netlify/lib/media-advice-response.mjs';

const FILM = { identityTitle: 'Авторська шукана назва', originalTitle: 'Authored sought film', year: 2006, imdbId: 'tt999900003' };
const URLS = ['authored-sought-film', 'unrelated-authored-film'].map(slug => `https://kinobazaua.com/titles/${slug}`);
const TITLE = 'Можливо, нерелевантні результати пошуку';
function candidate({ status = 'unresolved', reason = 'director-alias-unestablished', knownTitle = true, equalYear = true } = {}) {
  return { identity: { status, reason, diagnostics: {
    counts: { headingCount: 1, originalTitleCount: 1 },
    comparisons: { headingAliasMatch: knownTitle, originalAliasMatch: knownTitle, yearEqual: equalYear },
    gates: { 'heading-alias': knownTitle ? 'pass' : 'fail' },
  } } };
}
function mixed({ first = candidate(), firstYear = 2006 } = {}) {
  const observations = new Map([
    [URLS[0], { sourceTitleCompleteness: { h1: true, h2: true }, sourceIdentity: {
      h1: [`Авторська шукана назва (${firstYear})`], h2: ['Authored sought film'],
    } }],
    [URLS[1], { sourceTitleCompleteness: { h1: true, h2: true }, sourceIdentity: {
      h1: ['Інший авторський фільм (2015)'], h2: ['Unrelated authored film'],
    } }],
  ]);
  const cards = [{ url: URLS[0], result: first }, { url: URLS[1], result: candidate({ status: 'mismatch', reason: 'source-title-conflict', knownTitle: false, equalYear: false }) }];
  return possibleIrrelevantSearch({ film: FILM, searches: [], cards, observations });
}
function result(diagnostic = mixed()) {
  return { film: { title: FILM.identityTitle, year: FILM.year, imdbId: FILM.imdbId }, rows: [],
    capabilities: { mykola_media_advice: true, mykola_media_advice_diagnostics: true },
    resolver: { possibleIrrelevantSearch: diagnostic,
      directorProfile: { status: 'unresolved', reason: 'profile-html-parse-errors', sourceAttempts: 2,
        selection: { eligibleCards: 1, unverifiedCards: 0, selectedCards: [1], basis: 'selected-year' } },
    },
  };
}

test('current mixed diagnostic preserves the compatible director-blocked card and unrelated read card without confirming either', () => {
  const diagnostic = mixed();
  assert.deepEqual(diagnostic.cards.map(card => [card.url, card.identity, card.reason, card.titleMismatch]), [
    [URLS[0], 'unresolved', 'director-alias-unestablished', false],
    [URLS[1], 'mismatch', 'source-title-conflict', true],
  ]);
  const report = safeMediaReport(result(diagnostic));
  assert.ok(report.includes(TITLE), 'current heading is broad enough to include mixed blockers');
  assert.match(report, /Жодна прочитана картка не підтвердилася/);
  assert.match(report, /profile-html-parse-errors/);
  assert.match(report, /identity unresolved; причина відхилення director-alias-unestablished; ознака незбігу назв unknown/);
  assert.match(report, /identity mismatch; причина відхилення source-title-conflict; ознака незбігу назв possible/);
  assert.ok(report.includes(URLS[0]) && report.includes(URLS[1]));
  assert.doesNotMatch(report, /identity matched|правильну картку підтверджено|помилку Tavily доведено/);
});

test('a compatible director-only refusal cannot by itself create a possible-irrelevance section', () => {
  const diagnostic = mixed();
  assert.ok(diagnostic);
  const onlyCompatible = { ...diagnostic, cards: [diagnostic.cards[0]] };
  const report = safeMediaReport(result(onlyCompatible));
  assert.ok(!report.includes(TITLE));
  assert.ok(report.includes('profile-html-parse-errors'));
  assert.ok(!report.includes(URLS[0]));
});

test('titleMismatch false is not title/year confirmation: the safe card payload contains no independent year comparison', () => {
  const diagnostic = mixed({ first: candidate({ reason: 'source-year-conflict-without-stable-crosswalk', equalYear: false }), firstYear: 2005 });
  const card = diagnostic.cards[0];
  assert.equal(card.titleMismatch, false);
  assert.equal(card.reason, 'source-year-conflict-without-stable-crosswalk');
  assert.equal(Object.hasOwn(card, 'yearEqual'), false);
  assert.equal(Object.hasOwn(card, 'comparisons'), false);
  assert.equal(Object.hasOwn(card, 'year'), false);
  const report = safeMediaReport(result(diagnostic));
  assert.ok(report.includes('Авторська шукана назва (2005)'));
  assert.ok(report.includes('причина відхилення source-year-conflict-without-stable-crosswalk'));
  assert.doesNotMatch(report, /назва й рік підтверджені|назва та рік збігаються/);
});

test('mixed observations do not escape ordinary Beta, missing capability or final response projection', () => {
  for (const capability of [undefined, false, 'true']) {
    const ordinary = result();
    ordinary.capabilities = capability === undefined ? undefined : { mykola_media_advice_diagnostics: capability };
    const report = safeMediaReport(ordinary);
    assert.ok(!report.includes(TITLE));
    assert.ok(!report.includes(URLS[0]) && !report.includes(URLS[1]));
  }
  const ordinary = productMediaResult(result(), { mykola_media_advice: true, mykola_media_advice_diagnostics: false });
  assert.equal(ordinary.resolver, undefined);
  assert.doesNotMatch(JSON.stringify(ordinary), /profile-html-parse-errors|directorProfile|possibleIrrelevantSearch|unrelated-authored-film/);
});

test('a fully matched card suppresses the section even when other read cards are unrelated', () => {
  assert.equal(mixed({ first: candidate({ status: 'matched', reason: 'explicit-title-year-director-match' }) }), null);
});
