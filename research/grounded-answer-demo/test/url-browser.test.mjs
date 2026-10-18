import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../server.mjs';
import { syntheticResponse } from '../synthetic.mjs';
import { requestBody } from '../config.mjs';
import { APPLE_UA_CARDS } from '../url-context.mjs';

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const options = { retrieval: 'url-context', discovery: 'digital-ua' };
test('offline URL-only browser + iPhone-sized viewport (not real iPhone)', { skip: !modulePath }, async t => {
  const { chromium, webkit } = await import(pathToFileURL(modulePath).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  t.after(() => browser.close());
  const cases = [
    ...Object.keys(APPLE_UA_CARDS).flatMap(filmId => [false, true].map(mockedLive => ({ filmId, mockedLive, scenario: 'grounded' }))),
    ...['retrieval-error', 'retrieval-paywall', 'retrieval-unsafe', 'ungrounded', 'empty', 'api-error', 'missing-key', 'foreign-url', 'truncated', 'script-text', 'citation-metadata'].map(scenario => ({ filmId: 'dune-part-two', scenario, mockedLive: ['foreign-url', 'truncated', 'script-text', 'citation-metadata'].includes(scenario) })),
  ];
  for (const { filmId, scenario, mockedLive } of cases) await t.test(`${filmId} / ${scenario} / ${mockedLive ? 'mocked API' : 'synthetic'}`, async t => {
    let calls = 0; let sent;
    const fixtureScenario = ['foreign-url', 'truncated', 'script-text', 'citation-metadata', 'missing-key'].includes(scenario) ? 'grounded' : scenario;
    const original = syntheticResponse(fixtureScenario, filmId, options);
    if (scenario === 'foreign-url') original.candidates[0].urlContextMetadata.urlMetadata[0].retrievedUrl = 'https://example.com/unrelated';
    if (scenario === 'truncated') original.candidates[0].finishReason = 'MAX_TOKENS';
    if (scenario === 'script-text') original.candidates[0].content.parts[0].text += '\n<script>window.UNSAFE_EXECUTED=true</script>';
    if (scenario === 'citation-metadata') {
      original.candidates[0].citationMetadata = { citationSources: [{ uri: APPLE_UA_CARDS[filmId], license: 'provider license unchanged' }] };
      original.candidates[0].groundingMetadata = { groundingChunks: [{ web: { uri: APPLE_UA_CARDS[filmId], title: 'provider grounding source unchanged' } }] };
    }
    const server = createDemo({ ...options, filmId,
      scenario: fixtureScenario, mode: mockedLive || scenario === 'missing-key' ? 'live' : 'synthetic', apiKey: mockedLive ? 'offline-url-key' : '',
      fetchImpl: async (_, init) => { calls++; sent = JSON.parse(init.body); return Response.json(original); },
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    t.after(() => page.close());
    const logs = []; let posts = 0;
    page.on('console', message => logs.push(message.text()));
    page.on('request', request => { if (request.method() === 'POST') posts++; });
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin);
    await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(calls, 0); assert.equal(posts, 0);
    assert.match(await page.locator('#retrieval-mode').textContent(), /url-context/);
    assert.ok((await page.locator('#source-url').textContent()).includes(APPLE_UA_CARDS[filmId]));
    const displayedPrompt = await page.locator('#prompt').textContent();
    assert.equal(displayedPrompt, requestBody(filmId, options).contents[0].parts[0].text);
    assert.equal(await page.locator('input,textarea,select').count(), 0);
    await page.locator('#run').evaluate(button => { button.click(); button.click(); });
    await page.waitForFunction(() => !document.querySelector('#status').textContent.startsWith('Waiting'));
    assert.equal(posts, 1); assert.equal(calls, mockedLive ? 1 : 0);
    assert.equal(await page.locator('#run').isDisabled(), true);
    if (mockedLive) {
      assert.equal(sent.contents[0].parts[0].text, displayedPrompt);
      assert.deepEqual(sent.tools, [{ urlContext: {} }]);
    }
    if (['empty', 'api-error', 'missing-key'].includes(scenario)) {
      assert.equal(await page.locator('#result').isVisible(), false);
      assert.match(await page.locator('#status').textContent(), /Empty|error|GEMINI_API_KEY/);
    } else {
      assert.equal(await page.locator('#result').isVisible(), true);
      assert.equal(await page.locator('#answer').textContent(), scenario === 'truncated' ? '' : original.candidates[0].content.parts[0].text);
      const shown = await page.locator('#retrieval-result').textContent();
      if (scenario.startsWith('retrieval-') || ['ungrounded', 'foreign-url'].includes(scenario)) assert.match(shown, /NOT established/);
      if (scenario === 'truncated') assert.match(shown, /no partial text displayed/);
      if (scenario === 'grounded') assert.match(shown, /Not proof of truth, freshness or Ukrainian entitlement/);
      if (!mockedLive) assert.match(shown, /SYNTHETIC retrieval metadata/);
      if (scenario === 'citation-metadata') {
        assert.match(shown, /provider license unchanged/);
        assert.match(shown, /provider grounding source unchanged/);
      }
      for (const selector of ['#source-url', '#prompt', '#run', '#retrieval-result']) {
        await page.locator(selector).scrollIntoViewIfNeeded(); assert.equal(await page.locator(selector).isVisible(), true);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    assert.equal(await page.locator('#suggestions').textContent(), '');
    assert.equal(await page.locator('#suggestions').evaluate(el => el.shadowRoot?.childNodes.length ?? 0), 0);
    assert.equal(await page.evaluate(() => !!window.UNSAFE_EXECUTED), false);
    assert.ok(!logs.some(text => text.includes('invented URL Context display')));
    assert.deepEqual(await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, databases: (await indexedDB.databases()).length, caches: (await caches.keys()).length })), { local: 0, session: 0, databases: 0, caches: 0 });
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(await page.locator('#answer').textContent(), '');
    assert.equal(await page.locator('#retrieval-result').textContent(), '');
    assert.equal(posts, 1); assert.equal(calls, mockedLive ? 1 : 0);
  });
  await t.test('WebKit URL-only narrow viewport', { skip: !existsSync(webkit.executablePath()) && 'WebKit binary absent; no download.' }, async t => {
    const server = createDemo({ ...options, fetchImpl: () => assert.fail('Provider forbidden') });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const engine = await webkit.launch({ headless: true }); t.after(() => engine.close());
    const page = await engine.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin); await page.waitForFunction(() => !document.querySelector('#run').disabled);
    await page.locator('#run').click(); await page.locator('#result').waitFor({ state: 'visible' });
    assert.match(await page.locator('#retrieval-result').textContent(), /SYNTHETIC retrieval metadata/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
});
