import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../server.mjs';
import { syntheticResponse } from '../synthetic.mjs';

// Optional external test tooling; no dependency is installed into production.
const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
test('offline browser display, interactions and persistence', { skip: !modulePath }, async t => {
  const { chromium } = await import(pathToFileURL(modulePath).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  t.after(() => browser.close());
  for (const scenario of ['grounded', 'api-error', 'empty', 'ungrounded', 'missing-key']) await t.test(scenario, async t => {
    const server = createDemo({ mode: scenario === 'missing-key' ? 'live' : 'synthetic', scenario: scenario === 'missing-key' ? 'grounded' : scenario, fetchImpl: () => assert.fail('Provider network forbidden') });
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
    await page.locator('#run').evaluate(button => { button.click(); button.click(); });
    await page.waitForFunction(() => !document.querySelector('#status').textContent.startsWith('Waiting'));
    assert.equal(posts, 1);
    assert.equal(await page.locator('#run').isDisabled(), true);
    if (scenario === 'grounded') {
      assert.equal(await page.locator('#result').isVisible(), true);
      const originalText = await page.locator('#answer').evaluate(answer => [...answer.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(''));
      assert.equal(originalText, syntheticResponse().candidates[0].content.parts[0].text);
      assert.equal(await page.locator('#answer a').getAttribute('href'), 'https://example.com/synthetic-edition');
      assert.equal(await page.locator('#suggestions a').getAttribute('href'), 'https://www.google.com/search?q=Dune+Part+Two+4K+UHD');
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
    assert.ok(!consoleMessages.some(text => text.includes('Example edition:')));
    const storage = await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, databases: (await indexedDB.databases()).length, caches: (await caches.keys()).length }));
    assert.deepEqual(storage, { local: 0, session: 0, databases: 0, caches: 0 });
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.equal(await page.locator('#result').isVisible(), false);
    assert.equal(await page.locator('#answer').textContent(), '');
    assert.equal(posts, 1); // reload does not automatically run a request
  });
});
