// Authored source fixtures, not archived live offers or provider entitlement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { composeDiscovery, mapProvider } from '../research/grounded-answer-demo/discovery.mjs';
import { projectTmdbProvidersFor } from '../research/grounded-answer-demo/tmdb.mjs';
import { normalizeMotnFor } from '../research/grounded-answer-demo/motn.mjs';
import { extractHtml } from '../research/grounded-answer-demo/html-source.mjs';
import { syntheticHtml } from '../research/grounded-answer-demo/synthetic.mjs';
import { FILMS } from '../research/grounded-answer-demo/config.mjs';
import { classifyLink } from '../shared/media-link-policy.mjs';
import { presentMediaGroups } from '../assets/media-advice-presentation.mjs';
import { makePreview, applyPreview, linkChoicesFor } from '../assets/media-advice.mjs';
import { discoverMedia } from '../netlify/lib/media-advice-service.mjs';
import { productMediaResult } from '../netlify/lib/media-advice-response.mjs';
import { fetchAssistedKinobaza } from '../research/grounded-answer-demo/assisted-kinobaza.mjs';

const film = FILMS.coherence;
const expected = { imdbId: 'tt2866360', tmdbId: 220289, title: 'Coherence', titleAliases: ['Coherence'], year: 2013, director: 'James Ward Byrkit' };
const plusURL = 'https://tv.apple.com/ua/movie/authored-subscription/umc.cmc.authoronly?at=AUTHORED%2fExact#Original';
const storeURL = 'https://itunes.apple.com/ua/movie/id123456?at=AUTHORED%2fStore#Original';
const stage = result => ({ result, status: result?.status ?? 'disabled-no-request', receivedAt: '2026-11-07T00:00:00Z', elapsedMs: 0 });
const tmdb = ua => ({ identity: { identity: { status: 'matched' } }, providers: projectTmdbProvidersFor({ id: expected.tmdbId, results: { UA: ua } }, expected) });
const motn = options => normalizeMotnFor({ imdbId: expected.imdbId, tmdbId: `movie/${expected.tmdbId}`, showType: 'movie', originalTitle: expected.title, releaseYear: expected.year, streamingOptions: { ua: options } }, expected);
function compose({ ua = {}, options = [], kino = null } = {}) {
  return composeDiscovery(film, { tmdb: stage(tmdb(ua)), motn: stage(motn(options)), kinobaza: stage(kino) });
}
const option = (name, type, link, fields = {}) => ({ service: { id: 'apple', name }, type, link, ...fields });
const caption = (provider, href, text = '(укр. субтитри)') => `<p class="mt-2"><a title="Доступно в ${provider}" href="${href}"><img alt="Доступно в ${provider}"></a> ${text}</p>`;
const kinoHTML = body => syntheticHtml(film).replace('<div id="availabilityAccordion">', `${body}<div id="availabilityAccordion">`);
function regionalHTML(label = 'Subscription', name = 'Apple TV') {
  const anchor = `<a title="Дивитись / Купити на ${name}" href="https://click.justwatch.com/a?authored=regional%2fOnly"><img alt="${name}"><div class="text-body fw-bold">${name}</div><div class="text-body fw-bold">${label}</div></a>`;
  return kinoHTML('').replace('<a title="Дивитись / Купити на Example UA" href="https://example.com/redirect?x=%2F&amp;y=1"><img alt="Example UA">Example UA</a>', anchor);
}
const plusGroup = result => presentMediaGroups(result.rows, { filmId: film.id }).find(info => info.group.key === 'appletvplus');

test('Apple subscription and Store are explicit separate canonical services, never inferred from a link', () => {
  assert.equal(mapProvider('tmdb', 350, 'Apple TV+', 'subscription')?.key, 'appletvplus');
  assert.equal(mapProvider('tmdb', 350, 'Apple TV', 'subscription')?.key, 'appletvplus');
  assert.equal(mapProvider('tmdb', 2, 'Apple TV Store', 'purchase')?.key, 'apple');
  assert.equal(mapProvider('tmdb', 2, 'Apple TV', 'rental')?.key, 'apple');
  assert.equal(mapProvider('motn', 'apple', 'Apple TV', 'subscription')?.key, 'appletvplus');
  assert.equal(mapProvider('motn', 'apple', 'Apple TV', 'rent')?.key, 'apple');
  assert.equal(mapProvider('motn', 'apple', 'Apple TV', 'buy')?.key, 'apple');
  assert.equal(mapProvider('kinobaza', undefined, 'Apple TV+')?.key, 'appletvplus');
  for (const args of [
    ['tmdb', 2, 'Apple TV+', 'subscription'], ['tmdb', 350, 'Apple TV Store', 'purchase'],
    ['motn', 'other', 'Apple TV', 'subscription'], ['motn', 'apple', 'Apple TV Store', 'subscription'],
    ['motn', 'apple', 'Apple TV+', 'rent'], ['motn', 'apple', 'Apple TV', undefined],
    ['tmdb', 350, 'Apple TV', undefined], ['tmdb', 350, 'Apple TV+ Amazon Channel', 'subscription'],
    ['motn', 'apple', 'Apple TV', 'addon'], ['motn', 'apple', 'Apple TV', 'free'],
    ['kinobaza', undefined, 'Apple TV Store', 'subscription'],
    ['kinobaza', undefined, 'Apple TV'], ['kinobaza', undefined, 'Unknown service'],
  ]) assert.equal(mapProvider(...args), null, JSON.stringify(args));
});

test('TMDb bucket is preserved and three different source observations do not become Store offers', async () => {
  const kino = await extractHtml(kinoHTML(caption('Apple TV+', plusURL)), film);
  assert.equal(kino.identity.status, 'matched');
  const result = compose({ ua: { flatrate: [{ provider_id: 350, provider_name: 'Apple TV' }] }, options: [option('Apple TV', 'subscription', plusURL)], kino });
  const rows = result.rows.filter(row => row.provider.key === 'appletvplus');
  assert.equal(rows.length, 3);
  assert.equal(result.rows.some(row => row.provider.key === 'apple'), false);
  assert.equal(result.unmapped.some(row => /apple/i.test(row.name ?? '')), false);
  assert.equal(rows.find(row => row.id.startsWith('tmdb:')).access.value, 'subscription');
  assert.equal(rows.find(row => row.id.startsWith('motn:')).access.value, 'subscription');
  assert.equal(rows.find(row => row.id.startsWith('tmdb:')).link.transferable, false, 'TMDb watch page is not a provider deep link');
  assert.equal(rows.find(row => row.id.startsWith('motn:')).link.href, plusURL);
  assert.equal(rows.find(row => row.id.startsWith('kinobaza:')).link.href, plusURL);
  const info = plusGroup(result);
  assert.ok(info);
  assert.equal(info.comparison.subtitles.symbol, '+');
  assert.equal(info.comparison.audio.symbol, '?');
  assert.equal(rows.find(row => row.id.startsWith('tmdb:')).subtitles.state, 'unknown', 'no source-row language borrowing');
  assert.notEqual(rows.find(row => row.id.startsWith('motn:')).subtitles.state, 'reported-positive');
});

test('mixed subscription/rental/purchase are distinct groups and retain each original source row', () => {
  const result = compose({
    ua: { flatrate: [{ provider_id: 350, provider_name: 'Apple TV+' }], rent: [{ provider_id: 2, provider_name: 'Apple TV Store' }], buy: [{ provider_id: 2, provider_name: 'Apple TV Store' }] },
    options: [option('Apple TV', 'subscription', plusURL), option('Apple TV', 'rent', storeURL), option('Apple TV', 'buy', storeURL)],
  });
  assert.equal(result.rows.length, 6);
  assert.equal(result.unmapped.length, 0, 'MOTN shared service ID with different explicit access is not by itself a conflict');
  const before = JSON.stringify(result.rows);
  const groups = presentMediaGroups(result.rows, { filmId: film.id });
  assert.deepEqual(groups.map(info => info.group.key).sort(), ['apple', 'appletvplus']);
  assert.equal(groups.find(info => info.group.key === 'apple').group.rows.length, 4);
  assert.equal(groups.find(info => info.group.key === 'appletvplus').group.rows.length, 2);
  assert.equal(JSON.stringify(result.rows), before);
});

test('Kino regional Apple TV requires its own explicit subscription label; channel and unknown access stay separate', async () => {
  const kino = await extractHtml(regionalHTML(), film), result = compose({ kino });
  const row = result.rows.find(row => row.provider.key === 'appletvplus');
  assert.ok(row);
  assert.equal(row.provider.sourceName, 'Apple TV', 'the literal source label is not rewritten to create block association');
  assert.equal(row.access.value, 'subscription');
  assert.equal(row.country, 'UA');
  assert.equal(row.link.kind, 'tracking-redirect');
  assert.equal(row.subtitles.state, 'unknown', 'regional access does not borrow the top-caption language');
  for (const [label, name] of [['Unknown', 'Apple TV'], ['Subscription', 'Apple TV Amazon Channel']]) {
    const refused = compose({ kino: await extractHtml(regionalHTML(label, name), film) });
    assert.equal(refused.rows.some(row => row.provider.key === 'appletvplus'), false);
    assert.equal(refused.unmapped.some(row => row.source === 'kinobaza' && row.name === name), true);
  }
  for (const html of [
    regionalHTML().replace('<div class="text-body fw-bold">Subscription</div>', '<div class="text-body fw-bold">Subscription</div><div class="text-body fw-bold">Buy</div>'),
    regionalHTML().replace('<div class="text-body fw-bold">Subscription</div></a>', '</a><div class="text-body fw-bold">Subscription</div>'),
  ]) {
    const refused = compose({ kino: await extractHtml(html, film) });
    assert.equal(refused.rows.some(row => row.provider.key === 'appletvplus'), false, 'contradictory or sibling access cannot supply the missing scope');
  }
});

test('subscription captions stay bound to their own block and never populate Store tracks', async () => {
  const store = `<p class="mt-2"><a title="Доступно в itunes" href="${storeURL}"><img alt="Доступно в itunes"></a> (укр. аудіо)</p>`;
  const kino = await extractHtml(kinoHTML(caption('Apple TV+', plusURL) + store), film);
  const result = compose({ kino });
  const groups = presentMediaGroups(result.rows, { filmId: film.id });
  const plus = groups.find(info => info.group.key === 'appletvplus'), apple = groups.find(info => info.group.key === 'apple');
  assert.equal(plus.comparison.audio.symbol, '?');
  assert.equal(plus.comparison.subtitles.symbol, '+');
  assert.equal(apple.comparison.audio.symbol, '+');
  assert.equal(apple.comparison.subtitles.symbol, '?');
  assert.ok(plus.group.rows.every(row => row.kinobazaLocalization?.provider === 'Apple TV+'));
  assert.ok(apple.group.rows.every(row => row.kinobazaLocalization?.provider === 'itunes'));
});

test('same-source conflicting provider IDs, incomplete ambiguous labels, and unknown services remain explicit', () => {
  const result = compose({
    ua: { flatrate: [{ provider_id: 350, provider_name: 'Apple TV+' }, { provider_id: 350, provider_name: 'Netflix' }], rent: [{ provider_id: 2, provider_name: 'Apple TV Store' }] },
    options: [option('Unknown service', 'subscription', plusURL), option('Apple TV', undefined, plusURL)],
  });
  assert.equal(result.rows.some(row => row.provider.key === 'appletvplus'), false);
  assert.equal(result.rows.filter(row => row.provider.key === 'apple').length, 1);
  assert.ok(result.unmapped.filter(row => row.source === 'tmdb').every(row => row.reason === 'provider-id-conflict'));
  assert.equal(result.unmapped.filter(row => row.source === 'motn').length, 2);
});

test('a contradictory MOTN label is not excused by legitimate Apple access scopes', () => {
  for (const contradictory of [
    option('Netflix', 'subscription', 'https://www.netflix.com/ua/title/123456'),
    option('Netflix', 'buy', 'https://www.netflix.com/ua/title/123456'),
    option('Apple TV Store', 'subscription', storeURL),
  ]) {
    const result = compose({ options: [
      option('Apple TV', 'subscription', plusURL, { subtitles: [{ locale: { language: 'uk' } }] }), contradictory,
    ] });
    assert.equal(result.rows.length, 0, contradictory.service.name + '/' + contradictory.type);
    assert.equal(result.unmapped.length, 2);
    assert.ok(result.unmapped.every(row => row.reason === 'provider-id-conflict'));
  }
  const valid = [option('Apple TV', 'subscription', plusURL), option('Apple TV', 'rent', storeURL)];
  for (const contradictory of [option('Apple TV+', 'rent', storeURL), option('Apple TV Store', 'subscription', plusURL), option('Netflix', 'buy', storeURL)]) {
    const result = compose({ options: [...valid, contradictory] });
    assert.equal(result.rows.length, 0, 'a third contradictory label cannot hide inside the legitimate dual-access exception');
    assert.equal(result.unmapped.length, 3);
    assert.ok(result.unmapped.every(row => row.reason === 'provider-id-conflict'));
  }
  const unresolved = compose({ options: [...valid, option('Unknown', 'subscription', plusURL)] });
  assert.equal(unresolved.rows.length, 2, 'a genuinely unknown label is not proof that the valid observations conflict');
  assert.equal(unresolved.unmapped.length, 1);
});

test('an explicit purchase label cannot become an Apple TV+ subscription solely from a brand badge', async () => {
  const buyBadge = caption('Apple TV+', plusURL).replaceAll('Доступно в Apple TV+', 'Купити в Apple TV+');
  const suffixedBuyBadge = buyBadge.replaceAll('Купити в Apple TV+', 'Купити в Apple TV+ з українською аудіо доріжкою / субтитрами');
  for (const [index, html] of [kinoHTML(buyBadge), kinoHTML(suffixedBuyBadge), regionalHTML('Buy', 'Apple TV+'), regionalHTML('Buy', ' Apple TV+ '), regionalHTML('Buy', 'Apple TV Plus')].entries()) {
    const result = compose({ kino: await extractHtml(html, film) });
    assert.equal(result.rows.some(row => row.provider.key === 'appletvplus'), false, `contradictory source access is not subscription evidence (case ${index + 1})`);
  }
});

test('unsafe or ambiguous provider blocks cannot lend positive subscription tracks', async () => {
  for (const body of [
    caption('Apple TV+', 'javascript:alert(1)'),
    caption('Apple TV+', plusURL).replace(' (укр. субтитри)', `<a title="Доступно в netflix" href="https://www.netflix.com/ua/title/123">Netflix</a> (укр. субтитри)`),
    caption('Apple TV+', plusURL, '(укр. субтитри, невідоме)'),
  ]) {
    const kino = await extractHtml(kinoHTML(body), film), result = compose({ kino });
    const info = plusGroup(result);
    if (info) assert.equal(info.comparison.subtitles.symbol, '?');
  }
});

test('Apple subscription mapping cannot bypass any source film-identity gate', async () => {
  const kino = await extractHtml(kinoHTML(caption('Apple TV+', plusURL)), film);
  const tmdbResult = tmdb({ flatrate: [{ provider_id: 350, provider_name: 'Apple TV+' }] });
  tmdbResult.providers.identity = { status: 'mismatch' };
  const motnResult = motn([option('Apple TV', 'subscription', plusURL)]);
  motnResult.identity.status = 'mismatch';
  kino.identity.status = 'unresolved';
  const result = composeDiscovery(film, { tmdb: stage(tmdbResult), motn: stage(motnResult), kinobaza: stage(kino) });
  assert.equal(result.rows.length, 0);
  assert.equal(result.unmapped.length, 0);
  assert.equal(presentMediaGroups(result.rows, { filmId: film.id }).length, 0);
});

test('subscription URL policy retains exact spelling but never promotes an iTunes Store URL', () => {
  const plus = { key: 'appletvplus' };
  const classified = classifyLink(plusURL, plus);
  assert.equal(classified.href, plusURL);
  assert.equal(classified.transferable, true);
  assert.equal(classifyLink(storeURL, plus).transferable, false);
  assert.equal(classifyLink('https://tv.apple.com/ua/channel/tvs.missing', plus).transferable, false);
  for (const href of ['javascript:alert(1)', 'https://user:password@tv.apple.com/ua/movie/a/umc.cmc.authored', 'https://example.test/movie/authored']) assert.equal(classifyLink(href, plus).transferable, false);
});

test('subscription selection requires explicit preview/apply and preserves exact source URL', () => {
  const result = compose({ options: [option('Apple TV', 'subscription', plusURL)] });
  const row = result.rows.find(row => row.provider.key === 'appletvplus');
  assert.ok(row);
  const before = { recommended_medium: 'DVD', purchase_url: 'https://example.test/old' }, snapshot = JSON.stringify(row);
  const info = plusGroup(result), choices = linkChoicesFor(info);
  assert.equal(choices.length, 1);
  const preview = makePreview(row, before);
  assert.equal(preview.after.recommended_medium, 'Apple TV+');
  assert.equal(preview.after.purchase_url, plusURL);
  assert.deepEqual(before, { recommended_medium: 'DVD', purchase_url: 'https://example.test/old' });
  assert.deepEqual(applyPreview(preview, before), preview.after);
  assert.equal(applyPreview(preview, { ...before, purchase_url: 'changed while preview open' }), null);
  assert.equal(JSON.stringify(row), snapshot);
});

test('server discovery preserves Apple subscription source rows, existing reservations, and ordinary Beta diagnostic protection', async () => {
  const sourceURL = 'https://kinobazaua.com/titles/authored-subscription-pipeline';
  const html = kinoHTML(caption('Apple TV+', plusURL)).replace('SYNTHETIC Coherence', 'Coherence')
    .replace('</head>', `<link rel="canonical" href="${sourceURL}"></head>`);
  const details = {
    id: expected.tmdbId, imdb_id: expected.imdbId, title: expected.title, original_title: expected.title, release_date: '2013-01-01',
    external_ids: { imdb_id: expected.imdbId }, alternative_titles: { titles: [] }, release_dates: { results: [] }, translations: { translations: [] },
    credits: { crew: [{ id: 999900001, name: expected.director, original_name: expected.director, job: 'Director' }] }, spoken_languages: [],
  };
  const sent = [], reserved = [];
  const fetchImpl = async (url, init) => {
    sent.push(url);
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    if (url === sourceURL) {
      assert.equal(reserved.at(-1), 'kinobaza-1', 'the existing reservation precedes the authored card read');
      assert.equal(init.headers.Authorization, undefined);
      return new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
    }
    if (url.startsWith('https://api.themoviedb.org/3/')) {
      assert.equal(init.headers.Authorization, 'Bearer AUTHORED_TMDB_TOKEN');
      const data = url.includes('/find/') ? { movie_results: [{ id: expected.tmdbId, title: expected.title, original_title: expected.title }] } :
        url.endsWith('/watch/providers') ? { id: expected.tmdbId, results: { UA: { flatrate: [{ provider_id: 350, provider_name: 'Apple TV' }] } } } : details;
      return Response.json(data);
    }
    assert.equal(url, `https://api.movieofthenight.com/v4/shows/${expected.imdbId}?country=ua`);
    assert.equal(init.headers['X-API-Key'], 'AUTHORED_MOTN_KEY'); assert.equal(init.headers.Authorization, undefined);
    return Response.json({ imdbId: expected.imdbId, tmdbId: `movie/${expected.tmdbId}`, showType: 'movie', originalTitle: expected.title,
      directors: [expected.director], releaseYear: expected.year, streamingOptions: { ua: [option('Apple TV', 'subscription', plusURL)] } });
  };
  const resolver = async (serverFilm, context) => {
    assert.equal(serverFilm.imdbId, expected.imdbId); assert.equal(serverFilm.directorCount, 1);
    assert.equal(context.sourceCap, 14);
    await context.reserve('kinobaza-1');
    const call = { stage: 'kinobaza-1', status: 'attempt-reserved' }; context.calls.push(call);
    const extraction = await fetchAssistedKinobaza(sourceURL, serverFilm, context.fetchImpl);
    call.httpStatus = extraction.httpStatus; call.status = 'response-received';
    assert.equal(extraction.identity.status, 'matched');
    return { status: extraction.status, result: extraction,
      resolver: { status: 'AUTHORED_IDENTITY_DETAIL', searchCalls: 0, cardCalls: 1 } };
  };
  const result = await discoverMedia({ imdbId: expected.imdbId, tmdbToken: 'AUTHORED_TMDB_TOKEN', motnKey: 'AUTHORED_MOTN_KEY',
    reserve: async name => reserved.push(name), fetchImpl, resolver, sourceCap: 14, diagnostics: true });
  assert.equal(sent.length, 5); assert.equal(reserved.length, 5); assert.equal(new Set(reserved).size, 5);
  assert.deepEqual(reserved.slice(0, 2), ['tmdb-find', 'tmdb-details']);
  assert.deepEqual(reserved.slice(2, 4).sort(), ['motn-title', 'tmdb-providers']);
  assert.equal(reserved[4], 'kinobaza-1');
  assert.equal(result.metrics.requestsMade, 5); assert.equal(result.metrics.requestBudget, 14);
  assert.equal(result.rows.length, 3); assert.ok(result.rows.every(row => row.provider.key === 'appletvplus'));
  assert.equal(result.rows.find(row => row.id.startsWith('tmdb:')).subtitles.state, 'unknown');
  assert.equal(result.rows.find(row => row.id.startsWith('motn:')).link.href, plusURL);
  assert.equal(result.rows.find(row => row.id.startsWith('kinobaza:')).link.href, plusURL);
  assert.equal(result.unmapped.length, 2, 'unrecognized authored source rows retain their own observations');
  assert.ok(result.unmapped.every(row => row.observation));
  assert.equal(result.stages, undefined);
  assert.doesNotMatch(JSON.stringify(result), /AUTHORED_TMDB_TOKEN|AUTHORED_MOTN_KEY/);
  const before = JSON.stringify(result);
  const publicResult = productMediaResult(result, { mykola_media_advice: true, mykola_media_advice_diagnostics: false });
  assert.equal(publicResult.rows.length, 3);
  assert.ok(publicResult.unmapped.every(row => Object.keys(row).join() === 'name'));
  assert.doesNotMatch(JSON.stringify(publicResult), /AUTHORED_IDENTITY_DETAIL|observations?|resolver|metrics|rawHref|sourceURL|directorPeople|directorAliases|identityContext|requestsMade/);
  const publicInfo = presentMediaGroups(publicResult.rows, { filmId: publicResult.film.id })[0];
  assert.equal(publicInfo.group.key, 'appletvplus'); assert.equal(publicInfo.comparison.subtitles.symbol, '+');
  assert.equal(publicInfo.comparison.audio.symbol, '?');
  const choices = linkChoicesFor(publicInfo); assert.equal(choices.length, 1);
  assert.equal(makePreview(choices[0].row, { recommended_medium: '', purchase_url: '' }).after.purchase_url, plusURL);
  assert.equal(JSON.stringify(result), before);
});
