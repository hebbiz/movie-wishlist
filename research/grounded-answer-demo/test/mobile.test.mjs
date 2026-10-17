import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createDemo } from '../server.mjs';

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
test('mobile-viewport synthetic display (not a real iPhone)', { skip: !modulePath }, async t => {
  const { chromium, webkit } = await import(pathToFileURL(modulePath).href);
  const engines = [{ name: 'installed Edge, narrow viewport', type: chromium, options: { channel: 'msedge' } }];
  if (existsSync(webkit.executablePath())) engines.push({ name: 'WebKit narrow viewport', type: webkit, options: {} });
  else await t.test('WebKit engine', { skip: 'WebKit binary is not installed; no download performed.' }, () => {});
  for (const engine of engines) await t.test(engine.name, async t => {
    const server = createDemo({ discovery: 'digital-ua', fetchImpl: () => assert.fail('Provider forbidden') });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await engine.type.launch({ headless: true, ...engine.options });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true });
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin);
    await page.waitForFunction(() => !document.querySelector('#run').disabled);
    await page.locator('#prompt').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#prompt').isVisible(), true);
    await page.locator('#run').click();
    await page.locator('#result').waitFor({ state: 'visible' });
    assert.match(await page.locator('#answer').textContent(), /SYNTHETIC ONLY/);
    for (const selector of ['#answer', '#answer a', '#suggestions a']) {
      const element = page.locator(selector).first();
      await element.scrollIntoViewIfNeeded();
      assert.equal(await element.isVisible(), true);
    }
    assert.equal(await page.locator('#run').isDisabled(), true);
    // No horizontal clipping introduced by the application layout.
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
  await t.test('opt-in same-host LAN Basic Auth, narrow Edge viewport', { skip: !process.env.DEMO_TEST_LAN_IPV4 }, async t => {
    const bindIPv4 = process.env.DEMO_TEST_LAN_IPV4;
    const password = 'offline-mobile-fixture';
    const server = createDemo({ access: 'lan', bindIPv4, lanPassword: password, discovery: 'digital-ua', fetchImpl: () => assert.fail('Provider forbidden') });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, bindIPv4, resolve); });
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://${bindIPv4}:${server.address().port}`;
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, httpCredentials: { username: 'demo', password } });
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin);
    await page.waitForFunction(() => !document.querySelector('#run').disabled);
    assert.ok(!(await page.locator('body').textContent()).includes(password));
    await page.locator('#run').click();
    await page.locator('#result').waitFor({ state: 'visible' });
    assert.match(await page.locator('#answer').textContent(), /SYNTHETIC ONLY/);
    for (const selector of ['#prompt', '#run', '#answer a', '#suggestions a']) {
      const item = page.locator(selector).first(); await item.scrollIntoViewIfNeeded();
      assert.equal(await item.isVisible(), true);
    }
    assert.equal(await page.locator('#run').isDisabled(), true);
  });
});
