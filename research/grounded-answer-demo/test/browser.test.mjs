import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../server.mjs';
import { syntheticResponse } from '../synthetic.mjs';
import { FILMS, selectFilm } from '../config.mjs';

// Optional external test tooling; no dependency is installed into production.
const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
test('offline browser display, interactions and persistence', { skip: !modulePath }, async t => {
  const { chromium } = await import(pathToFileURL(modulePath).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  t.after(() => browser.close());
  const cases = [
    ...Object.keys(FILMS).map(filmId => ({ scenario: 'grounded', filmId })),
    ...Object.keys(FILMS).map(filmId => ({ scenario: 'grounded', filmId, mockedLive: true })),
    ...['api-error', 'empty', 'ungrounded', 'missing-key'].map(scenario => ({ scenario, filmId: 'dune-part-two' })),
  ];
  for (const { scenario, filmId, mockedLive } of cases) await t.test(`${filmId} / ${scenario}${mockedLive ? ' / mocked API' : ''}`, async t => {
    let providerCalls = 0;
    let sentPrompt;
    const film = selectFilm(filmId);
    const server = createDemo({
      filmId, mode: mockedLive || scenario === 'missing-key' ? 'live' : 'synthetic',
      scenario: scenario === 'missing-key' ? 'grounded' : scenario,
      apiKey: mockedLive ? 'offline-test-key' : '',
      fetchImpl: async (_, options) => {
        if (!mockedLive) assert.fail('Provider network forbidden');
        providerCalls++;
        sentPrompt = JSON.parse(options.body).contents[0].parts[0].text;
        return Response.json(syntheticResponse('grounded', filmId));
      },
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await browser.newPage();
    t.after(() => page.close());
    const consoleMessages = [];
    let posts = 0;
    page.on('console', message => consoleMessages.push(message.text()));
    // Absolutely no external page/suggestion/source traffic during tests.
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    page.on('request', request => { if (request.method() === 'POST') posts++; });
    await page.goto(origin);
    await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(posts, 0);
    assert.equal(providerCalls, 0);
    assert.ok((await page.locator('#film').textContent()).includes(film.title));
    assert.ok((await page.locator('#director').textContent()).includes(film.director));
    assert.equal(await page.locator('#prompt').isVisible(), true);
    const displayedPrompt = await page.locator('#prompt').textContent();
    assert.equal(displayedPrompt, film.prompt);
    await page.locator('#run').evaluate(button => { button.click(); button.click(); });
    await page.waitForFunction(() => !document.querySelector('#status').textContent.startsWith('Waiting'));
    assert.equal(posts, 1);
    assert.equal(await page.locator('#run').isDisabled(), true);
    assert.equal(providerCalls, mockedLive ? 1 : 0);
    if (mockedLive) assert.equal(sentPrompt, displayedPrompt);
    if (scenario === 'grounded') {
      assert.equal(await page.locator('#result').isVisible(), true);
      const originalText = await page.locator('#answer').evaluate(answer => [...answer.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(''));
      assert.equal(originalText, syntheticResponse('grounded', filmId).candidates[0].content.parts[0].text);
      assert.equal(await page.locator('#answer a').getAttribute('href'), 'https://example.com/synthetic-edition');
      assert.equal(await page.locator('#suggestions a').getAttribute('href'), `https://www.google.com/search?q=${encodeURIComponent(film.title)}`);
      assert.equal(await page.locator('#suggestions a').getAttribute('target'), null);
      assert.equal(await page.locator('#suggestions a').evaluate(link => getComputedStyle(link).paddingTop), '16px');
      // Narrow view: suggestions remain visible and in normal document flow.
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.locator('#suggestions a').isVisible(), true);
      // Reject active HTML without displaying or rewriting it.
      const rejected = await page.evaluate(async () => {
        const { renderSuggestions } = await import('/display.mjs');
        try { renderSuggestions(document, document.createElement('div'), '<a href="https://example.com" onclick="alert(1)">unsafe</a>'); return false; }
        catch { return true; }
      });
      assert.equal(rejected, true);
    } else {
      assert.equal(await page.locator('#result').isVisible(), false);
      assert.match(await page.locator('#status').textContent(), /error|Empty|Ungrounded|GEMINI_API_KEY/i);
    }
    assert.ok(!consoleMessages.some(text => text.includes('Invented display example')));
    const storage = await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, databases: (await indexedDB.databases()).length, caches: (await caches.keys()).length }));
    assert.deepEqual(storage, { local: 0, session: 0, databases: 0, caches: 0 });
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(await page.locator('#result').isVisible(), false);
    assert.equal(await page.locator('#answer').textContent(), '');
    assert.equal(posts, 1); // reload does not automatically run a request
    assert.equal(providerCalls, mockedLive ? 1 : 0);
  });
});
