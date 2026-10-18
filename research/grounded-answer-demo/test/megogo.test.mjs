import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { requestBody, selectRequest } from '../config.mjs';
import { createDemo } from '../server.mjs';
import { extractMegogo, fetchMegogo, MEGOGO_URL, MEGOGO_LIMIT_BYTES, MEGOGO_TIMEOUT_MS } from '../megogo.mjs';
import { syntheticMegogo } from '../megogo-synthetic.mjs';

const selection = selectRequest({ retrieval: 'megogo-html', discovery: 'digital-ua' });
const response = html => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
const partial = (fields = '', movie = {}) => syntheticMegogo({ movie }).replace(/<dl>[\s\S]*?<\/dl>/, `<dl><dt>Year</dt><dd>2024</dd>${fields}</dl>`);
const field = (label, value) => `<dt>${label}</dt><dd>${value}</dd>`;
const observations = (r, key) => r.cardFields[key].observations.map(o => o.value);

test('MEGOGO fixed config / no model, keys, arbitrary URL or unsupported combinations', () => {
  assert.equal(selection.sourceURL, MEGOGO_URL); assert.equal(selection.film.id, 'dune-part-two');
  assert.equal(selection.prompt, null); assert.throws(() => requestBody('dune-part-two', { retrieval: 'megogo-html', discovery: 'digital-ua' }), /no Gemini/);
  for (const options of [{ filmId: 'coherence' }, { filmId: 'blade-runner-final-cut' }, { discovery: 'physical' }, { amazonRegion: 'us' }, { urlSource: 'kinobaza' }]) {
    assert.throws(() => selectRequest({ retrieval: 'megogo-html', discovery: 'digital-ua', ...options }), /requires/);
  }
  assert.equal(MEGOGO_TIMEOUT_MS, 20_000); assert.equal(MEGOGO_LIMIT_BYTES, 2 * 1024 * 1024);
});
test('MEGOGO authored synthetic identity and public metadata do not require account entitlement', async () => {
  const r = await extractMegogo(syntheticMegogo());
  assert.equal(r.identity.status, 'matched'); assert.equal(r.status, 'ok');
  assert.deepEqual(r.identity.observed.nativeIds, ['22027436']);
  assert.equal(r.accountEntitlement.state, 'unknown'); assert.equal(r.fetcherGeography.state, 'unknown');
  assert.deepEqual(observations(r, 'package'), ['SYNTHETIC Example Package']);
  assert.deepEqual(observations(r, 'price'), [{ amount: '1.23', currency: 'XXX' }]);
  assert.deepEqual(observations(r, 'resolution'), [['SD']]);
  assert.equal(r.cardFields.hdr10.state, 'unknown'); assert.equal(r.cardFields.dolbyVision.state, 'unknown');
  assert.ok(!JSON.stringify(r).includes('<script>'));
});
for (const [name, html, expected] of [
  ['wrong native', syntheticMegogo().replaceAll('22027436', '999'), 'mismatch'],
  ['wrong IMDb', syntheticMegogo({ movie: { sameAs: 'https://www.imdb.com/title/tt9999999/' } }), 'mismatch'],
  ['wrong TMDb alongside correct IMDb', syntheticMegogo({ movie: { sameAs: ['https://www.imdb.com/title/tt15239678/', 'https://www.themoviedb.org/movie/999'] } }), 'mismatch'],
  ['wrong title', syntheticMegogo({ movie: { name: 'Another Film' } }), 'mismatch'],
  ['no identity', '<!doctype html><main><p>Unknown card</p></main>', 'unknown'],
  ['no JSON identity but labelled visible title/year/native', syntheticMegogo({ noJson: true }), 'matched'],
]) test(`MEGOGO identity: ${name}`, async () => {
  const r = await extractMegogo(html); assert.equal(r.identity.status, expected);
  if (expected !== 'matched') assert.equal(r.cardFields.audio.observations.length, 0);
});
test('MEGOGO partial/missing metadata: original language not audio; unknown not absent', async () => {
  const r = await extractMegogo(partial('', { inLanguage: 'uk', videoFormat: 'UHD' }));
  assert.equal(r.identity.status, 'matched'); assert.equal(r.status, 'partial');
  for (const key of ['audio', 'subtitles', 'resolution', 'hdr10', 'dolbyVision', 'price', 'access', 'region']) assert.equal(r.cardFields[key].state, 'unknown');
});
test('MEGOGO audio formats bound only to a single language clause, not global badges', async () => {
  const r = await extractMegogo(partial(field('Audio', '<ul><li>English PCM 2.0</li><li>Ukrainian AAC 5.1</li><li>English and Ukrainian Dolby Atmos 7.1</li></ul>') + '<p>Dolby Atmos</p>'));
  const [a, b, c] = observations(r, 'audio')[0];
  assert.deepEqual(a.locales, ['en']); assert.deepEqual(a.codecs, ['PCM']); assert.deepEqual(a.channels, ['2.0']);
  assert.deepEqual(b.locales, ['uk']); assert.deepEqual(b.codecs, ['AAC']); assert.deepEqual(b.channels, ['5.1']);
  assert.equal(c.association, 'unknown'); assert.deepEqual(c.codecs, []); assert.deepEqual(c.channels, []);
});
test('MEGOGO subtitle types, explicit absence and missing association kept distinct', async () => {
  const r = await extractMegogo(partial(field('Subtitles', 'Ukrainian standard; English forced CC SDH; Ukrainian and English forced') + field('Audio', 'No Ukrainian audio')));
  const [uk, en, ambiguous] = observations(r, 'subtitles')[0];
  assert.deepEqual(uk.subtitleTypes, ['standard']); assert.deepEqual(en.subtitleTypes, ['forced', 'CC', 'SDH']);
  assert.deepEqual(ambiguous.subtitleTypes, []);
  assert.equal(observations(r, 'audio')[0][0].presence, 'explicit-negative-claim');
});
test('MEGOGO HD/UHD, HDR10, DV are independent, conflicts retained', async () => {
  const r = await extractMegogo(partial(field('Quality', 'HD, UHD') + field('HDR10', 'yes') + field('HDR10', 'no') + field('Dolby Vision', 'no') + field('Package', 'Example A') + field('Package', 'Example B')));
  assert.deepEqual(observations(r, 'resolution'), [['HD', 'UHD']]);
  assert.equal(r.cardFields.hdr10.state, 'conflicting'); assert.equal(r.cardFields.package.state, 'conflicting');
  assert.deepEqual(observations(r, 'dolbyVision'), [false]);
  const uhd = await extractMegogo(partial(field('Quality', 'UHD')));
  assert.equal(uhd.cardFields.hdr10.state, 'unknown'); assert.equal(uhd.cardFields.dolbyVision.state, 'unknown');
});
test('MEGOGO contradictory track claims retained; negated format is not a missing language', async () => {
  const r = await extractMegogo(partial(field('Audio', 'No Ukrainian audio') + field('Audio', 'Ukrainian AAC') + field('Subtitles', 'No English subtitles') + field('Subtitles', 'English standard')));
  assert.equal(r.cardFields.audio.state, 'conflicting'); assert.equal(r.cardFields.subtitles.state, 'conflicting');
  const format = await extractMegogo(partial(field('Audio', 'English, not Atmos')));
  assert.equal(observations(format, 'audio')[0][0].presence, 'listed-claim');
});
test('MEGOGO prices require explicit currency, never infer UAH from /ua/', async () => {
  for (const value of ['3.99', '$3.99', 'Free', 'UAH', 'NaN USD']) {
    const r = await extractMegogo(partial(field('Price', value))); assert.equal(r.cardFields.price.state, 'unknown');
  }
  assert.deepEqual(observations(await extractMegogo(partial(field('Price', 'USD 3.99'))), 'price'), [{ amount: '3.99', currency: 'USD' }]);
});
test('MEGOGO JSON-LD offers kept separate; access/region/price and no card-to-offer propagation', async () => {
  const r = await extractMegogo(partial(field('Audio', 'English AAC'), { offers: [
    { '@type': 'Offer', businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut', price: '2.34', priceCurrency: 'XXX', eligibleRegion: 'UA' },
    { '@type': 'Offer', businessFunction: 'http://purl.org/goodrelations/v1#Sell', price: 4.56, ineligibleRegion: { '@type': 'Country', name: 'Example territory' }, additionalProperty: [{ '@type': 'PropertyValue', name: 'Package', value: 'Example offer only' }] },
  ] }));
  assert.equal(r.offers.length, 2); assert.equal(r.offers[0].fields.access.observations[0].value, 'rental');
  assert.equal(r.offers[1].fields.access.observations[0].value, 'purchase'); assert.equal(r.offers[1].fields.price.state, 'unknown');
  for (const o of r.offers) assert.equal(o.fields.audio.state, 'unknown');
  assert.equal(r.cardFields.package.state, 'unknown'); assert.equal(r.fetcherGeography.state, 'unknown');
});
test('MEGOGO JSON-LD properties read without evaluating executable data', async () => {
  const r = await extractMegogo(partial('', { additionalProperty: [
    { '@type': 'PropertyValue', name: 'Audio', value: 'Spanish PCM 1.0' },
    { '@type': 'PropertyValue', name: 'Quality', value: '4K, HDR10, Dolby Vision' },
  ] }));
  assert.equal(r.status, 'ok'); assert.deepEqual(observations(r, 'resolution'), [['4K']]);
  assert.deepEqual(observations(r, 'hdr10'), [true]); assert.deepEqual(observations(r, 'dolbyVision'), [true]);
});
test('MEGOGO malformed JSON / unsupported markup / login-only / safe text', async () => {
  const html = partial(field('Audio', 'Sign in to see tracks') + field('Package', '&lt;img src=x onerror=alert(1)&gt;') + '<div class="related"><dl><dt>Quality</dt><dd>4K</dd></dl></div><dt>HDR10</dt><dd hidden>yes</dd>');
  const r = await extractMegogo(html.replace('</head>', '<script type="application/ld+json">{broken</script></head>'));
  assert.equal(r.status, 'partial'); assert.ok(r.issues.some(s => s.includes('malformed')));
  assert.equal(r.cardFields.audio.state, 'unknown'); assert.match(r.cardFields.audio.note, /Login\/JS-only/);
  assert.deepEqual(observations(r, 'package'), ['<img src=x onerror=alert(1)>']);
  assert.equal(r.cardFields.resolution.state, 'unknown'); assert.equal(r.cardFields.hdr10.state, 'unknown');
});
test('MEGOGO explicit geo restriction retains matched public metadata; /ua/ not geography', async () => {
  const r = await extractMegogo(syntheticMegogo({ body: '<p>Not available in your country</p>' }));
  assert.equal(r.status, 'geo-restricted-public-metadata'); assert.equal(r.identity.status, 'matched');
  assert.equal(r.cardFields.audio.state, 'reported'); assert.equal(r.accountEntitlement.state, 'unknown');
  assert.equal(r.fetcherGeography.state, 'unknown'); assert.equal(r.cardFields.region.state, 'reported');
});
test('MEGOGO visible CAPTCHA is not bypassed', async () => {
  const r = await extractMegogo(syntheticMegogo({ body: '<p>Verify you are human</p>' }));
  assert.equal(r.status, 'captcha-no-retry'); assert.equal(r.identity.status, 'unknown');
});
test('MEGOGO recoverable warnings use the standard DOM, identity evaluated independently', async () => {
  const cases = [
    ['legacy doctype', syntheticMegogo().replace('<!doctype html>', '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">'), 'non-conforming-doctype'],
    ['recoverable text entity', syntheticMegogo({ body: '<p>Example &copy label</p>' }), 'missing-semicolon-after-character-reference'],
    ['truncated comment', syntheticMegogo() + '<!-- incomplete', 'eof-in-comment'],
  ];
  for (const [name, html, expected] of cases) {
    const r = await extractMegogo(html);
    assert.equal(r.status, 'ok', name); assert.equal(r.identity.status, 'matched', name);
    assert.deepEqual(r.issues, [], name);
    assert.equal(r.diagnostics.stage, 'html-acceptance', name);
    assert.equal(r.diagnostics.identityEvaluation, 'matched', name);
    assert.deepEqual(r.diagnostics.parseErrors, { total: 1, byCode: [{ code: expected, count: 1, action: expected === 'eof-in-comment' ? 'scope-check' : 'warning' }] }, name);
    assert.equal(r.diagnostics.structure.mainElements, 1, name); assert.equal(r.diagnostics.structure.h1Elements, 1, name);
    assert.equal(r.diagnostics.structure.canonicalLinks, 1, name); assert.equal(r.diagnostics.structure.jsonLdBlocks, 1, name);
    assert.equal(r.cardFields.audio.state, 'reported', name); assert.equal(r.accountEntitlement.state, 'unknown', name);
  }
});
test('MEGOGO diagnostic counts include errors after the old 20-event cap; no content/URL/attribute/position leaks', async () => {
  const privateMarker = 'PRIVATE_DIAGNOSTIC_TEXT_DO_NOT_RETURN';
  const r = await extractMegogo(syntheticMegogo({ body: `<p data-private="${privateMarker}" data-private="other">${privateMarker} ${'&copy text '.repeat(25)}</p>` }) + '<!-- truncated');
  assert.equal(r.status, 'ok'); assert.equal(r.identity.status, 'matched');
  const codes = r.diagnostics.parseErrors.byCode;
  assert.equal(codes.find(e => e.code === 'missing-semicolon-after-character-reference').count, 25);
  assert.equal(codes.find(e => e.code === 'eof-in-comment').count, 1); assert.equal(r.diagnostics.parseErrors.total, 27);
  assert.doesNotMatch(JSON.stringify(r.diagnostics), /PRIVATE|data-private|other|https?:|Dune|22027436|startOffset|startLine|snippet/);
});
test('MEGOGO error-free HTML / optional end tags and existing missing-doctype allowance still pass identity', async () => {
  for (const html of [syntheticMegogo(), syntheticMegogo().replace('<!doctype html>', ''), syntheticMegogo().replaceAll('</dt>', '').replaceAll('</dd>', '')]) {
    const r = await extractMegogo(html); assert.equal(r.identity.status, 'matched'); assert.equal(r.status, 'ok');
  }
});
test('MEGOGO mixed recoverable errors keep scope; structure bounds still refuse the page', async () => {
  const mixed = await extractMegogo(syntheticMegogo({ body: '<p data-test=x data-test=y>Example</p>' }).replace('<!doctype html>', ''));
  assert.deepEqual(mixed.diagnostics.parseErrors.byCode, [
    { code: 'missing-doctype', count: 1, action: 'warning' }, { code: 'duplicate-attribute', count: 1, action: 'scope-check' },
  ]);
  assert.equal(mixed.identity.status, 'matched');
  const deep = await extractMegogo(syntheticMegogo({ body: '<div data-test=x data-test=y>' + '<div>'.repeat(270) + '</div>'.repeat(271) }));
  assert.equal(deep.status, 'unsupported-markup'); assert.deepEqual(deep.diagnostics.pageRefusals, ['parser-or-structure-limit']);
  assert.equal(deep.identity.status, 'unknown');
});
test('MEGOGO mock HTTP returns useful fields and diagnostics together once, no raw content or second fetch', async t => {
  const marker = 'PRIVATE_MOCK_RESPONSE_DO_NOT_RETURN'; let calls = 0;
  const server = createDemo({ mode: 'live', retrieval: 'megogo-html', discovery: 'digital-ua', fetchImpl: async () => {
    calls++; return response(syntheticMegogo({ body: `<p data-private="${marker}" data-private="other">${marker}</p>` }));
  } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => new Promise(r => server.close(r)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const session = await (await fetch(`${origin}/session`)).json(); assert.equal(calls, 0);
  const headers = { origin, 'x-demo-session': session.token };
  const res = await fetch(`${origin}/answer`, { method: 'POST', headers });
  assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store');
  const text = await res.text(), r = JSON.parse(text).result;
  assert.equal(r.httpStatus, 200); assert.equal(r.status, 'ok'); assert.equal(r.identity.status, 'matched');
  assert.equal(r.cardFields.audio.state, 'reported'); assert.equal(r.diagnostics.identityEvaluation, 'matched');
  assert.equal(r.diagnostics.parseErrors.byCode[0].code, 'duplicate-attribute'); assert.doesNotMatch(text, new RegExp(marker));
  assert.doesNotMatch(text, /data-private|<script|<main/); assert.equal(calls, 1);
  assert.equal((await fetch(`${origin}/answer`, { method: 'POST', headers })).status, 409); assert.equal(calls, 1);
});
test('MEGOGO duplicate attributes on identity/boundaries refuse instead of trusting the first value', async () => {
  for (const html of [
    syntheticMegogo().replace('<link rel="canonical"', '<link rel="canonical" rel="alternate"'),
    syntheticMegogo().replace(`href="${MEGOGO_URL}"`, `href="${MEGOGO_URL}" href="https://megogo.net/ua/view/999-other.html"`),
    syntheticMegogo().replace('<main>', '<main class="a" class="b">'),
    syntheticMegogo().replace('<h1>', '<h1 hidden hidden="false">'),
    syntheticMegogo().replace('type="application/ld+json"', 'type="application/ld+json" type="text/javascript"'),
    syntheticMegogo().replace('<h1>Dune: Part Two</h1>', '<h1><span class=a class=b>Dune: Part Two</span></h1>'),
  ]) {
    const r = await extractMegogo(html); assert.equal(r.identity.status, 'unknown'); assert.equal(r.diagnostics.decision, 'page-refused');
    assert.equal(r.diagnostics.identityEvaluation, 'not-run'); assert.equal(r.cardFields.audio.state, 'unknown');
  }
});
test('MEGOGO duplicate attributes in a field make only that field unknown, not a selected first value', async () => {
  const r = await extractMegogo(partial(field('Audio', '<span data-locale=en data-locale=uk>English AAC</span>') + field('Quality', 'SD') + field('Package', 'Example safe package'), {
    additionalProperty: [{ '@type': 'PropertyValue', name: 'Audio', value: 'Spanish PCM' }],
  }).replace('<main>', '<main>🎬 Unicode before scoped recovery'));
  assert.equal(r.identity.status, 'matched'); assert.equal(r.status, 'partial'); assert.equal(r.cardFields.audio.state, 'unknown');
  assert.deepEqual(r.cardFields.audio.observations, []); assert.equal(r.cardFields.package.state, 'reported');
  assert.deepEqual(r.diagnostics.refusedFields, ['audio']); assert.equal(r.cardFields.resolution.state, 'reported');
});
test('MEGOGO unclosed comment is not data: complete earlier fields survive, interrupted field withheld', async () => {
  const r = await extractMegogo(partial(field('Package', 'Earlier package') + '<dt>Audio</dt><dd>English AAC<!-- incomplete'));
  assert.equal(r.identity.status, 'matched'); assert.equal(r.cardFields.package.state, 'reported');
  assert.equal(r.cardFields.audio.state, 'unknown'); assert.deepEqual(r.diagnostics.refusedFields, ['audio']);
  const identity = await extractMegogo(syntheticMegogo().replace('Dune: Part Two</h1>', 'Dune: Part Two<!-- incomplete'));
  assert.equal(identity.identity.status, 'unknown'); assert.ok(identity.diagnostics.pageRefusals.includes('identity-scope-ambiguity'));
});
test('MEGOGO warnings never establish identity or override explicit conflicts', async () => {
  const r = await extractMegogo(syntheticMegogo({ body: '<p>&copy text</p>', movie: { '@id': 'https://megogo.net/ua/view/999-other.html' } }));
  assert.equal(r.identity.status, 'mismatch'); assert.equal(r.cardFields.audio.state, 'unknown');
  const empty = await extractMegogo('<!DOCTYPE html PUBLIC "legacy"><main>Unknown &copy text</main>');
  assert.equal(empty.identity.status, 'unknown'); assert.equal(empty.cardFields.audio.state, 'unknown');
});
test('MEGOGO unsupported recovery is a justified page refusal, not automatic acceptance of every parse error', async () => {
  for (const html of [syntheticMegogo() + '<div class="unfinished', syntheticMegogo({ body: '<p>Bad\u0000text</p>' })]) {
    const r = await extractMegogo(html); assert.equal(r.identity.status, 'unknown');
    assert.ok(r.diagnostics.pageRefusals.includes('unsupported-parse-recovery')); assert.equal(r.cardFields.audio.state, 'unknown');
  }
});
test('MEGOGO location-event bounds refuse, and ambiguous regional text is not selected by first attributes', async () => {
  const overflow = await extractMegogo(syntheticMegogo({ body: '<p class=a class=b>Example</p>'.repeat(257) }));
  assert.equal(overflow.identity.status, 'unknown'); assert.ok(overflow.diagnostics.pageRefusals.includes('recovery-location-limit'));
  const region = await extractMegogo(syntheticMegogo({ body: '<p class=normal class=ad>Not available in your country</p>' }));
  assert.equal(region.identity.status, 'matched'); assert.equal(region.cardFields.region.state, 'unknown');
});
test('MEGOGO duplicate visibility attributes cannot hide a conflicting field or identity signal', async () => {
  for (const body of [
    '<dt hidden hidden="false">Audio</dt><dd>English AAC</dd>',
    '<div hidden hidden="false"><dt>Audio</dt><dd>English AAC</dd></div>',
  ]) {
    const r = await extractMegogo(partial(body, { additionalProperty: [{ '@type': 'PropertyValue', name: 'Audio', value: 'Spanish PCM' }] }));
    assert.equal(r.identity.status, 'matched'); assert.equal(r.cardFields.audio.state, 'unknown'); assert.ok(r.diagnostics.refusedFields.includes('audio'));
  }
  const r = await extractMegogo(syntheticMegogo({ body: '<div hidden hidden="false"><dl><dt>Year</dt><dd>2099</dd></dl></div>' }));
  assert.equal(r.identity.status, 'unknown'); assert.ok(r.diagnostics.pageRefusals.includes('identity-scope-ambiguity'));
});
test('MEGOGO malformed JSON block is not repaired; duplicate keys cannot hide identity conflicts', async () => {
  const broken = await extractMegogo(syntheticMegogo({ noJson: true, head: '<script type="application/ld+json">{"@type":"Movie", broken</script>' }));
  assert.equal(broken.identity.status, 'matched'); assert.equal(broken.status, 'partial');
  assert.equal(broken.diagnostics.ignoredJsonLdBlocks, 1); assert.equal(broken.cardFields.audio.state, 'reported');
  for (const json of ['{"@context":"https://schema.org","@type":"Movie","name":"Wrong film","name":"Dune: Part Two"}', '{"@context":"https://schema.org","@type":"Movie","name":"Wrong","na\\u006de":"Dune: Part Two"}']) {
    const html = syntheticMegogo({ noJson: true, head: `<script type="application/ld+json">${json}</script>` });
    const r = await extractMegogo(html); assert.equal(r.identity.status, 'unknown'); assert.equal(r.status, 'unsupported-markup');
    assert.equal(r.diagnostics.ignoredJsonLdBlocks, 1); assert.equal(r.cardFields.audio.state, 'unknown');
    assert.ok(r.diagnostics.pageRefusals.includes('ambiguous-embedded-json-keys'));
  }
});
test('MEGOGO exact one bounded GET, no credentials, assets, destinations or key headers', async () => {
  let calls = 0;
  const r = await fetchMegogo(selection, async (url, init) => {
    calls++; assert.equal(url, MEGOGO_URL); assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    assert.deepEqual(Object.keys(init.headers).sort(), ['Accept', 'User-Agent']);
    return response(syntheticMegogo());
  });
  assert.equal(calls, 1); assert.equal(r.httpStatus, 200); assert.equal(r.identity.status, 'matched');
  await assert.rejects(fetchMegogo({ ...selection, sourceURL: 'https://example.com' }, () => assert.fail('No fetch')), /Fixed/);
});
for (const [status, expected] of [[302, 'redirect-not-followed'], [403, 'access-blocked-no-retry'], [429, 'rate-limited-no-retry'], [451, 'geo-or-legal-block-no-retry']]) test(`MEGOGO HTTP ${status} no retry`, async () => {
  let calls = 0; const r = await fetchMegogo(selection, async () => { calls++; return new Response('SECRET_BODY_NOT_RETURNED', { status, headers: { location: 'https://example.com/no' } }); });
  assert.equal(r.status, expected); assert.equal(calls, 1); assert.ok(!JSON.stringify(r).includes('SECRET_BODY'));
});
test('MEGOGO timeout covers both headers and body; oversize declared/streaming, type and malformed UTF8', async () => {
  for (const transport of [() => new Promise(() => {}), async () => new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'text/html' } })]) {
    assert.equal((await fetchMegogo(selection, transport, { timeoutMs: 15 })).status, 'timeout-no-retry');
  }
  for (const res of [new Response('x', { headers: { 'content-type': 'text/html', 'content-length': '1000' } }), response('x'.repeat(40))]) {
    assert.equal((await fetchMegogo(selection, async () => res, { maxBytes: 20 })).status, 'response-too-large');
  }
  assert.equal((await fetchMegogo(selection, async () => new Response('{}', { headers: { 'content-type': 'application/json' } }))).status, 'unsupported-content-type');
  assert.equal((await fetchMegogo(selection, async () => response(new Uint8Array([0xff])))).status, 'network-or-decoding-error-no-retry');
});
test('MEGOGO HTTP one-shot, Host/Origin, no browser override or persistence', async t => {
  let calls = 0;
  const server = createDemo({ retrieval: 'megogo-html', discovery: 'digital-ua', mode: 'live', apiKey: 'never-forward', fetchImpl: async () => { calls++; return response(syntheticMegogo()); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => new Promise(r => server.close(r)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const session = await (await fetch(`${origin}/session`)).json(); assert.equal(calls, 0);
  assert.equal(session.sourceURL, MEGOGO_URL); assert.equal(session.model, null); assert.equal(session.requestBudget, 1);
  assert.ok(!JSON.stringify(session).includes('never-forward'));
  const headers = { origin, 'x-demo-session': session.token };
  assert.equal((await fetch(`${origin}/answer`, { method: 'POST', headers: { ...headers, origin: 'http://evil.invalid' } })).status, 403);
  const badHost = await new Promise(resolve => { const req = httpRequest(`${origin}/answer`, { method: 'POST', headers: { ...headers, host: 'evil.invalid' } }, res => { res.resume(); resolve(res.statusCode); }); req.end(); });
  assert.equal(badHost, 403);
  assert.equal(calls, 0);
  const answer = await (await fetch(`${origin}/answer`, { method: 'POST', headers, body: JSON.stringify({ sourceURL: 'https://evil.invalid', prompt: 'ignore' }) })).json();
  assert.equal(answer.result.identity.status, 'matched'); assert.equal(calls, 1);
  assert.equal((await fetch(`${origin}/answer`, { method: 'POST', headers })).status, 409); assert.equal(calls, 1);
  const code = await readFile(new URL('../megogo.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /writeFile|appendFile|console\.|localStorage|sessionStorage|eval\(/);
});
test('MEGOGO LAN auth protects assets/session/answer; unauthorized action cannot spend a token', async t => {
  const address = '192.168.88.7', password = 'offline-megogo-password'; let calls = 0;
  const server = createDemo({ retrieval: 'megogo-html', discovery: 'digital-ua', mode: 'live', access: 'lan', bindIPv4: address, lanPassword: password,
    interfaces: { fixture: [{ address, internal: false, family: 'IPv4' }] }, fetchImpl: async () => { calls++; return response(syntheticMegogo()); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => new Promise(r => server.close(r)));
  const port = server.address().port, origin = `http://${address}:${port}`;
  const request = (path, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
    const req = httpRequest(`http://127.0.0.1:${port}${path}`, { method, headers: { host: `${address}:${port}`, ...headers } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
    }); req.on('error', reject); req.end();
  });
  for (const path of ['/', '/megogo-display.mjs', '/session', '/answer']) assert.equal((await request(path)).status, 401);
  const auth = { authorization: `Basic ${Buffer.from(`demo:${password}`).toString('base64')}` };
  const sessionResponse = await request('/session', auth); assert.equal(sessionResponse.headers.get('cache-control'), 'no-store');
  const session = await sessionResponse.json(); assert.equal(calls, 0);
  const headers = { ...auth, origin, 'x-demo-session': session.token };
  assert.equal((await request('/answer', { ...headers, authorization: 'Basic d3Jvbmc=' }, 'POST')).status, 401);
  assert.equal(calls, 0);
  const result = await (await request('/answer', headers, 'POST')).json(); assert.equal(result.result.identity.status, 'matched'); assert.equal(calls, 1);
  assert.ok(!JSON.stringify({ session, result }).includes(password));
  assert.equal((await request('/answer', headers, 'POST')).status, 409);
});
