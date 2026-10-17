import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createDemo } from '../server.mjs';
import { syntheticResponse } from '../synthetic.mjs';
import { displayParts, byteIndex, once } from '../public/display.mjs';
import { MODEL, MAX_OUTPUT_TOKENS, PROMPT, requestBody } from '../config.mjs';

const clone = () => syntheticResponse();
const metadata = response => response.candidates[0].groundingMetadata;

test('synthetic fixture is explicitly labelled, complete and includes attribution', () => {
  const response = clone();
  const displayed = displayParts(response);
  assert.equal(displayed.parts[0].text, response.candidates[0].content.parts[0].text);
  assert.match(displayed.parts[0].text, /SYNTHETIC ONLY/);
  assert.equal(displayed.chunks[0].web.uri, 'https://example.com/synthetic-edition');
  assert.match(displayed.suggestions, /SYNTHETIC Search Suggestion/);
});

test('UTF-8 boundaries, including emoji, are not JavaScript indices', () => {
  assert.equal(byteIndex('Ї🪐X', 6), 3);
  for (const invalid of [-1, 1, 3, 7.5, 8, undefined]) assert.throws(() => byteIndex('Ї🪐X', invalid));
});

test('missing protobuf zero indices are supported without guessing nonzero positions', () => {
  const response = clone();
  const text = response.candidates[0].content.parts[0].text;
  metadata(response).groundingSupports[0].segment = { endIndex: Buffer.byteLength(text), text };
  assert.equal(displayParts(response).parts[0].citations[0].end, text.length);
});

test('invalid citations fail closed instead of inventing placement', () => {
  for (const change of [
    r => { metadata(r).groundingSupports[0].segment.endIndex = 1; },
    r => { metadata(r).groundingSupports[0].segment.text = 'unrelated'; },
    r => { metadata(r).groundingSupports[0].segment.partIndex = 9; },
    r => { metadata(r).groundingSupports[0].groundingChunkIndices = [99]; },
    r => { metadata(r).groundingChunks[0].web.uri = 'javascript:alert(1)'; },
  ]) {
    const response = clone(); change(response);
    assert.throws(() => displayParts(response));
  }
});

test('empty, ungrounded, missing suggestions, invalid and truncated responses are not displayed', () => {
  for (const response of [null, {}, syntheticResponse('empty'), syntheticResponse('ungrounded')]) assert.throws(() => displayParts(response));
  const noSuggestions = clone(); delete metadata(noSuggestions).searchEntryPoint;
  assert.throws(() => displayParts(noSuggestions), /Search Suggestions/);
  const truncated = clone(); truncated.candidates[0].finishReason = 'MAX_TOKENS';
  assert.throws(() => displayParts(truncated), /Incomplete/);
});

test('multi-Part original text and Part-local offsets preserved; thought Parts excluded', () => {
  const response = clone();
  response.candidates[0].content.parts.unshift({ thought: true, text: 'not visible' }, { text: 'Ї🪐\n' });
  metadata(response).groundingSupports[0].segment.partIndex = 2;
  const data = displayParts(response);
  assert.equal(data.parts.length, 2);
  assert.equal(data.parts[0].text, 'Ї🪐\n');
  assert.equal(data.parts[1].text, clone().candidates[0].content.parts[0].text);
});

test('click gate prevents concurrent and subsequent calls, including failure', async () => {
  let count = 0;
  const action = once(async () => { count++; throw new Error('offline'); });
  await Promise.allSettled([action(), action(), action()]);
  await action();
  assert.equal(count, 1);
});

async function start(t, options) {
  const server = createDemo(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const session = await (await fetch(`${origin}/session`)).json();
  const post = (token = session.token, requestOrigin = origin) => fetch(`${origin}/answer`, {
    method: 'POST', headers: { Origin: requestOrigin, 'x-demo-session': token },
  });
  return { origin, session, post };
}

test('default mode is synthetic and never calls provider; replay blocked', async t => {
  const { origin, session, post } = await start(t, { fetchImpl: () => { throw new Error('Network forbidden'); } });
  assert.equal(session.mode, 'synthetic');
  const [first, second] = await Promise.all([post(), post()]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  assert.equal((await post()).status, 409);
  assert.equal((await fetch(`${origin}/server.mjs`)).status, 404);
});

test('missing key is explicit, one-shot, and makes no provider call', async t => {
  const { post } = await start(t, { mode: 'live', fetchImpl: () => assert.fail('Network forbidden') });
  const response = await post();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /GEMINI_API_KEY/);
  assert.equal((await post()).status, 409);
});

test('one mocked provider call; key only in server header, fixed prompt and parameters', async t => {
  let calls = 0;
  const { origin, session, post } = await start(t, { mode: 'live', apiKey: 'offline-test-key', fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`);
    assert.equal(options.headers['x-goog-api-key'], 'offline-test-key');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), requestBody());
    return Response.json(clone());
  } });
  assert.ok(!JSON.stringify(session).includes('offline-test-key'));
  const html = await (await fetch(origin)).text();
  assert.ok(!html.includes('offline-test-key'));
  assert.equal((await post()).status, 200);
  assert.equal((await post()).status, 409);
  assert.equal(calls, 1);
  assert.equal(requestBody().contents[0].parts[0].text, PROMPT);
  assert.equal(requestBody().generationConfig.maxOutputTokens, MAX_OUTPUT_TOKENS);
});

test('API HTTP, transport and invalid JSON errors are safe and never retried', async t => {
  for (const kind of ['http', 'transport', 'json']) await t.test(kind, async t => {
    let count = 0;
    const { post } = await start(t, { mode: 'live', apiKey: 'offline-test-key', fetchImpl: async () => {
      count++;
      if (kind === 'http') return new Response('SENSITIVE_PROVIDER_CONTENT', { status: 429 });
      if (kind === 'transport') throw new Error('SENSITIVE_PROVIDER_CONTENT');
      return new Response('SENSITIVE_PROVIDER_CONTENT');
    } });
    const response = await post();
    assert.equal(response.status, 502);
    const text = await response.text();
    assert.ok(!text.includes('SENSITIVE_PROVIDER_CONTENT'));
    assert.equal((await post()).status, 409);
    assert.equal(count, 1);
  });
});

test('cross-origin request cannot spend a session', async t => {
  const { post } = await start(t, {});
  assert.equal((await post(undefined, 'https://example.com')).status, 403);
  assert.equal((await post()).status, 200);
});

test('synthetic error scenarios exercise no provider', async t => {
  for (const scenario of ['api-error', 'empty', 'ungrounded']) await t.test(scenario, async t => {
    const { post } = await start(t, { scenario, fetchImpl: () => assert.fail('Network forbidden') });
    const response = await post();
    if (scenario === 'api-error') assert.equal(response.status, 502);
    else {
      const payload = await response.json();
      assert.throws(() => displayParts(payload.response));
    }
  });
});

test('source audit: no content persistence, logging, analytics or service worker hooks', async () => {
  const paths = ['../server.mjs', '../public/client.mjs', '../public/display.mjs', '../public/index.html'];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /writeFile|appendFile|createWriteStream|localStorage|sessionStorage|indexedDB|sendBeacon|serviceWorker|console\.(?:log|error)\([^'`]/);
  }
  const before = await readdir(new URL('../', import.meta.url));
  assert.ok(!before.some(name => ['runs', 'cache', 'archive', 'logs'].includes(name)));
});

test('README exact prompt stays synchronized with the request', async () => {
  const readme = (await readFile(new URL('../README.md', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  assert.equal(readme.match(/```text\n([\s\S]*?)\n```/)[1], PROMPT);
});
