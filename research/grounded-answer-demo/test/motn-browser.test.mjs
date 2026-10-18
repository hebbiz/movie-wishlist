import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../server.mjs';
import { syntheticMotn, MOTN_FILMS } from '../motn.mjs';

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
test('Movie of the Night compact mobile display (offline, not real iPhone)', { skip: !modulePath }, async t => {
  const { chromium, webkit } = await import(pathToFileURL(modulePath).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  t.after(() => browser.close());
  const cases = [
    ...['coherence', 'dune-part-two'].flatMap(filmId => ['synthetic', 'live'].map(mode => ({ filmId, mode, kind: 'normal' }))),
    ...['empty-ua', 'missing-key', 'auth-error', 'quota', 'invalid', 'identity', 'hostile'].map(kind => ({ filmId: 'coherence', mode: 'live', kind })),
  ];
  for (const { filmId, mode, kind } of cases) await t.test(`${filmId}/${mode}/${kind}`, async t => {
    let calls = 0; const key = 'offline-browser-key-sentinel';
    const expectedURL = `https://api.movieofthenight.com/v4/shows/${MOTN_FILMS[filmId].imdbId}?country=ua`;
    const server = createDemo({ filmId, mode, retrieval: 'motn-api', discovery: 'digital-ua', motnKey: kind === 'missing-key' ? '' : key,
      fetchImpl: async (url, init) => {
        calls++; assert.equal(url, expectedURL);
        assert.equal(init.headers['X-API-Key'], key);
        if (kind === 'auth-error' || kind === 'quota') return new Response('PRIVATE_PROVIDER_CONTENT', { status: kind === 'quota' ? 429 : 401 });
        if (kind === 'invalid') return new Response('not json', { headers: { 'content-type': 'application/json' } });
        const data = syntheticMotn(filmId);
        if (kind === 'empty-ua') data.streamingOptions.ua = [];
        if (kind === 'identity') data.imdbId = 'tt0000000';
        if (kind === 'hostile') {
          data.streamingOptions.ua[0].service.name = '<img src="https://example.com/never-load" onerror="alert(1)">';
          data.streamingOptions.ua[0].link = 'javascript:alert(1)';
        }
        return Response.json(data);
      } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    t.after(() => page.close());
    const external = [], logs = []; let posts = 0;
    page.on('request', req => { if (!req.url().startsWith(origin)) external.push(req.url()); if (req.method() === 'POST') posts++; });
    page.on('console', message => logs.push(message.text()));
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(calls, 0); assert.match(await page.locator('#retrieval-mode').textContent(), /motn-api/);
    assert.ok((await page.locator('#source-url').textContent()).includes(expectedURL));
    assert.ok((await page.locator('#film').textContent()).includes(filmId === 'coherence' ? 'Coherence' : 'Dune: Part Two'));
    assert.match(await page.locator('#settings').textContent(), /Country: UA.*no model/);
    assert.match(await page.locator('#prompt').textContent(), /No LLM/);
    assert.ok(!(await page.content()).includes(key)); assert.equal(await page.locator('input,textarea,select').count(), 0);
    await page.locator('#run').evaluate(button => { button.click(); button.click(); });
    await page.locator('#result').waitFor({ state: 'visible' });
    assert.equal(posts, 1); assert.equal(calls, mode === 'live' && kind !== 'missing-key' ? 1 : 0);
    const shown = await page.locator('#answer').textContent();
    assert.match(shown, /Country: UA.*Received:/); assert.match(shown, /not account entitlement/);
    assert.match(shown, /Streaming Availability API by Movie of the Night/);
    assert.match(shown, /UHD is not HDR10\/Dolby Vision/);
    assert.doesNotMatch(shown, /PRIVATE_PROVIDER_CONTENT|Foreign must not display|offline-browser-key-sentinel/);
    if (['normal', 'hostile'].includes(kind)) {
      assert.match(shown, /UA option 1/); assert.match(shown, /UA option 2/);
      assert.match(shown, /Ukrainian audio: Reported: ukr/);
      assert.match(shown, /Not listed; completeness unknown/); assert.match(shown, /Not reported in response/);
      assert.match(shown, /Video quality: uhd/); assert.match(shown, /1.23 XXX/);
      if (mode === 'synthetic') assert.match(shown, /SYNTHETIC ONLY/);
      if (kind === 'hostile') { assert.match(shown, /<img src=/); assert.doesNotMatch(shown, /javascript:alert/); }
    } else assert.match(shown, /no-ua-options|missing-key-no-request|api-auth-error|quota-or-rate-limit|invalid-or-network-response-no-retry|identity-unresolved/);
    assert.equal(await page.locator('#answer img,#answer script,#answer iframe').count(), 0);
    assert.equal(await page.locator('#answer a').count(), 1); // Static attribution only, not a provider link.
    assert.equal(await page.locator('#answer a').getAttribute('href'), 'https://www.movieofthenight.com/about/api');
    assert.equal(await page.locator('#suggestions').textContent(), ''); assert.equal(await page.locator('#retrieval-result').textContent(), '');
    assert.deepEqual(external, []); assert.ok(!logs.some(s => /SYNTHETIC Example|PRIVATE_PROVIDER|offline-browser-key/.test(s)));
    assert.deepEqual(await page.evaluate(async () => [localStorage.length, sessionStorage.length, (await indexedDB.databases()).length, (await caches.keys()).length]), [0, 0, 0, 0]);
    for (const selector of ['#source-url', '#prompt', '#run', '#answer']) { await page.locator(selector).scrollIntoViewIfNeeded(); assert.equal(await page.locator(selector).isVisible(), true); }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('#run').isDisabled(), true);
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(await page.locator('#answer').textContent(), ''); assert.equal(posts, 1);
  });
  await t.test('Movie of the Night WebKit viewport', { skip: !existsSync(webkit.executablePath()) && 'WebKit binary absent; no download.' }, async t => {
    const engine = await webkit.launch({ headless: true }); t.after(() => engine.close());
    const server = createDemo({ retrieval: 'motn-api', discovery: 'digital-ua', fetchImpl: () => assert.fail('No network') });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await engine.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    await page.locator('#run').click(); await page.locator('#result').waitFor({ state: 'visible' });
    assert.match(await page.locator('#answer').textContent(), /SYNTHETIC ONLY/);
  });
});
