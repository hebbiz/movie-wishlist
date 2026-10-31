// Authored structural regression, not captured/reconstructed Kinobaza HTML or
// a claim about real platform availability, films, links or language tracks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAssistedKinobaza } from '../research/grounded-answer-demo/assisted-kinobaza.mjs';
import { composeDiscovery } from '../research/grounded-answer-demo/discovery.mjs';
import { presentMediaGroups } from '../assets/media-advice-presentation.mjs';
import { linkChoicesFor, makePreview } from '../assets/media-advice.mjs';
import { safeMediaReport } from '../assets/media-advice-report.mjs';

const sourceURL = 'https://kinobazaua.com/titles/authored-recovery-film';
const film = { id: 'imdb:tt1234567', imdbId: 'tt1234567', tmdbId: 123, title: 'Authored Recovery Film',
  identityTitle: 'Authored Recovery Film', originalTitle: 'Authored Recovery Film', year: 2015,
  titleAliases: [], directorAliases: ['Authored Director'], directorCount: 1 };
const hrefs = {
  apple: 'https://itunes.apple.com/ua/movie/id999999?at=AUTHORED%2fONLY&x=1',
  rakuten: 'https://click.justwatch.com/a?authored=%2F&service=rakuten',
  megogo: 'https://megogo.net/ua/view/999999-authored.html?exact=%2f&x=1',
};
const attribute = value => value === null ? '' : ` href="${value.replaceAll('&', '&amp;')}"`;
function markup({ apple = hrefs.apple, director = 'Authored Director', imdbId = film.imdbId } = {}) {
  const table = (provider, href) => `<div class="mt-2 me-4"><a title="Купити в ${provider} з українською аудіо доріжкою / субтитрами"${attribute(href)}><img alt="Доступно в ${provider}"></a><table><tbody>
    <tr><th>Укр. субтитри</th><td>-</td></tr><tr><th>Укр. звук (стерео)</th><td>+</td></tr><tr><th>Укр. звук (dolby)</th><td>+</td></tr>
    <tr><td colspan="2"><a${attribute(href)}>Перейти в ${provider}</a></td></tr></tbody></table></div>`;
  return `<!doctype html><html><head><link rel="canonical" href="${sourceURL}"></head><body>
    <h1>Authored Recovery Film (2015)</h1><h2>Authored Recovery Film</h2>
    <table><tbody><tr><th>Режисер:</th><td>${director}</td></tr><tr><th>IMDb:</th><td>${imdbId}</td></tr></tbody></table>
    <div class="d-md-flex">${table('itunes', apple)}${table('rakuten', hrefs.rakuten)}</div>
    <p class="mt-2"><a title="Доступно в megogo"${attribute(hrefs.megogo)}><img alt="Доступно в megogo"></a> (укр. аудіо)</p>
    <div id="availabilityAccordion"><div class="accordion-item"><h2 class="accordion-header"><button data-bs-target="#collapseCZ">Доступно в Чехії</button></h2><div id="collapseCZ" data-bs-parent="#availabilityAccordion"></div></div></div>
    <div class="youtube-aspect"><img alt="Authored &quot;valid&quot; and "broken" trailer" src="https://example.com/authored-trailer.jpg"></div>
    </body></html>`;
}
async function pipeline(options) {
  let requests = 0;
  const extracted = await fetchAssistedKinobaza(sourceURL, film, async (url, init) => {
    requests++; assert.equal(url, sourceURL); assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    return new Response(markup(options), { headers: { 'content-type': 'text/html; charset=UTF-8' } });
  });
  const result = composeDiscovery(film, { tmdb: { result: null }, motn: { result: null }, kinobaza: { status: extracted.status, result: extracted } });
  return { extracted, result, groups: presentMediaGroups(result.rows, { filmId: film.id }), requests };
}

test('authored recovered trailer markup preserves Apple/Rakuten tables and MEGOGO tokens through M4 presentation and preview', async () => {
  const { extracted, result, groups, requests } = await pipeline();
  assert.equal(requests, 1); assert.equal(extracted.identity.status, 'matched'); assert.equal(extracted.status, 'partial');
  assert.deepEqual(extracted.issues, ['missing-explicit-ukraine-section', 'noncritical-image-markup-recovered']);
  assert.equal(extracted.localization.blocks.length, 3); assert.equal(extracted.candidates.length, 3);
  assert.deepEqual(result.rows.map(row => row.provider.key), ['apple', 'rakuten', 'megogo']);
  assert.deepEqual(groups.map(info => info.group.key), ['apple', 'rakuten', 'megogo']);
  for (const [index, key] of ['apple', 'rakuten', 'megogo'].entries()) {
    const row = result.rows[index], info = groups[index], block = row.kinobazaLocalization;
    assert.equal(row.link.href, hrefs[key]); assert.equal(block.href, hrefs[key]);
    assert.equal(row.rawHref, hrefs[key].replaceAll('&', '&amp;'));
    assert.equal(row.link.kind, key === 'rakuten' ? 'tracking-redirect' : 'exact-card-unverified');
    assert.equal(row.linkAudit.blockAssociation, 'associated'); assert.equal(block.audio.state, 'reported-positive');
    assert.equal(block.subtitles.state, key === 'megogo' ? 'unknown' : 'reported-negative'); assert.deepEqual(block.issues, []);
    assert.equal(info.kinobaza.applied, true); assert.equal(info.band, 'ua-audio');
    assert.equal(info.comparison.availability.symbol, '◐'); assert.equal(info.comparison.audio.symbol, '+');
    assert.equal(info.comparison.subtitles.symbol, key === 'megogo' ? '?' : '−');
    assert.equal(row.country, null); assert.equal(row.availability.state, 'unknown'); assert.equal(row.access.state, 'unknown');
    assert.equal(row.audio.state, 'unknown'); assert.equal(row.subtitles.state, 'unknown'); assert.equal(row.countrySignal, null);
    assert.deepEqual(linkChoicesFor(info).map(choice => choice.href), [hrefs[key]], 'duplicate table CTA is not another M4 choice');
    const preview = makePreview(info.transferRow, { recommended_medium: 'DVD', purchase_url: 'https://example.com/manual' });
    assert.equal(preview.rowId, row.id); assert.equal(preview.after.purchase_url, hrefs[key]);
    assert.deepEqual(Object.keys(preview.after).sort(), ['purchase_url', 'recommended_medium']);
  }
  assert.equal(result.filmLocalization.ukrainianAudio.state, 'unknown');
  const report = safeMediaReport(result);
  assert.match(report, /kinobaza\/apple: territory unknown; Kinobaza provider-block audio reported-positive, subtitles reported-negative/);
  assert.match(report, /kinobaza\/rakuten: territory unknown; Kinobaza provider-block audio reported-positive, subtitles reported-negative/);
  assert.match(report, /kinobaza\/megogo: territory unknown; Kinobaza provider-block audio reported-positive, subtitles unknown/);
  assert.doesNotMatch(report, /<html|authored-trailer|AUTHORED%2fONLY|click\.justwatch\.com/);
});

test('recovered page never promotes missing or unsafe Apple link to usable language/transfer evidence, while other blocks survive', async () => {
  for (const apple of [null, 'javascript:alert(1)']) {
    const { extracted, result, groups, requests } = await pipeline({ apple });
    assert.equal(requests, 1); assert.equal(extracted.identity.status, 'matched');
    const appleRow = result.rows.find(row => row.provider.key === 'apple'), info = groups.find(group => group.group.key === 'apple');
    assert.equal(appleRow.kinobazaLocalization.audio.state, 'reported-positive', 'source table stays distinct from safe link eligibility');
    assert.equal(appleRow.link.kind, apple === null ? 'missing' : 'unsafe'); assert.equal(appleRow.link.transferable, false);
    assert.equal(info.kinobaza.applied, false); assert.equal(info.comparison.audio.symbol, '?');
    assert.deepEqual(linkChoicesFor(info), []);
    assert.equal(makePreview(info.transferRow, { recommended_medium: 'DVD', purchase_url: 'https://example.com/manual' }), null);
    assert.ok(groups.filter(group => group.group.key !== 'apple').every(group => group.kinobaza.applied && group.comparison.audio.symbol === '+'));
    assert.doesNotMatch(JSON.stringify(result), /javascript:alert/);
  }
});

test('recovered irrelevant image errors do not bypass unresolved director or stable-ID conflict withholding', async () => {
  for (const [options, status, reason] of [
    [{ director: 'Unestablished Director Spelling' }, 'unresolved', 'director-alias-unestablished'],
    [{ imdbId: 'tt9999999' }, 'mismatch', 'source-stable-id-conflict'],
  ]) {
    const { extracted, result, groups, requests } = await pipeline(options);
    assert.equal(requests, 1); assert.equal(extracted.identity.status, status); assert.equal(extracted.identity.reason, reason);
    assert.deepEqual(extracted.candidates, []); assert.equal(extracted.localization, undefined);
    assert.deepEqual(result.rows, []); assert.equal(result.filmLocalization, null); assert.deepEqual(groups, []);
  }
});

test('actual authored extraction distinguishes top provider block from UA accordion before choosing one original Apple link', async () => {
  const tv = 'https://tv.apple.com/ua/movie/authored/umc.cmc.authored?playableId=tvs.sbd.9001%3A999999';
  const uaHref = `https://click.justwatch.com/a?cx=AUTHORED&r=${encodeURIComponent(tv)}&uct_country=ua`;
  const anchor = `<a title="Дивитись / Купити на Apple TV Store"${attribute(uaHref)}><img alt="Apple TV Store"></a>`;
  for (const upperHref of [tv, hrefs.apple, null]) {
    const body = markup({ apple: upperHref }).replaceAll('collapseCZ', 'collapseUA').replace('Доступно в Чехії', 'Доступно в Україні')
      .replace('data-bs-parent="#availabilityAccordion">', `data-bs-parent="#availabilityAccordion">${anchor}`);
    const extracted = await fetchAssistedKinobaza(sourceURL, film, async () => new Response(body, { headers: { 'content-type': 'text/html' } }));
    assert.equal(extracted.identity.status, 'matched');
    const result = composeDiscovery(film, { tmdb: { result: null }, motn: { result: null }, kinobaza: { status: extracted.status, result: extracted } });
    const before = JSON.stringify(result.rows), info = presentMediaGroups(result.rows, { filmId: film.id }).find(info => info.group.key === 'apple');
    const ua = info.group.rows.find(row => row.country === 'UA'), upper = info.group.rows.find(row => row.country === null);
    assert.equal(ua.territoryBasis, 'Explicit Ukrainian section; not entitlement');
    assert.equal(ua.countrySignal.href, uaHref); assert.equal(ua.countrySignal.territory.code, 'UA');
    assert.equal(ua.kinobazaLocalization, undefined);
    assert.equal(upper.territoryBasis, 'Outside territory section'); assert.equal(upper.linkAudit.blockAssociation, 'associated');
    assert.equal(upper.kinobazaLocalization.href, upperHref); assert.equal(upper.countrySignal, null);
    const choices = linkChoicesFor(info);
    assert.equal(choices.length, 1); assert.strictEqual(choices[0].row, upperHref ? upper : ua);
    assert.equal(choices[0].href, upperHref ?? uaHref);
    assert.equal(makePreview(choices[0].row, { recommended_medium: '', purchase_url: '' }).after.purchase_url, upperHref ?? uaHref);
    assert.equal(info.group.rows.length, 2); assert.equal(JSON.stringify(result.rows), before);
  }
});
