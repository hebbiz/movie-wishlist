import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDemo } from '../server.mjs';
import { syntheticResponse } from '../synthetic.mjs';
import { displayParts, byteIndex, once } from '../public/display.mjs';
import { MODEL, MAX_OUTPUT_TOKENS, PROMPT, DEFAULT_FILM, FILMS, selectFilm, requestBody } from '../config.mjs';

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
  assert.equal(session.film.id, 'dune-part-two');
  assert.equal(session.prompt, PROMPT);
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

test('default film and exact original Dune prompt are preserved', () => {
  assert.equal(DEFAULT_FILM, 'dune-part-two');
  assert.equal(selectFilm().id, DEFAULT_FILM);
  assert.equal(selectFilm().prompt, PROMPT);
  // SHA-256 of PROMPT at review baseline 3337fc9 (UTF-8, LF).
  assert.equal(createHash('sha256').update(PROMPT).digest('hex'), 'c6de933db248f8172dcef014376bd0557fec27baaeeeefcc35d12708571c8ce2');
  assert.deepEqual(requestBody(), requestBody(DEFAULT_FILM));
});

test('fixed catalogue identifies the films and preserves model/settings for every film', () => {
  assert.deepEqual(Object.keys(FILMS), ['dune-part-two', 'coherence', 'blade-runner-final-cut']);
  assert.equal(MODEL, 'gemini-3.8-flash');
  assert.equal(MAX_OUTPUT_TOKENS, 4096);
  for (const id of Object.keys(FILMS)) {
    const body = requestBody(id);
    assert.equal(body.contents[0].parts[0].text, selectFilm(id).prompt);
    assert.deepEqual(body.tools, [{ googleSearch: {} }]);
    assert.deepEqual(body.generationConfig, { maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: 'low' } });
    for (const instruction of PROMPT.split('\n').slice(1)) assert.ok(selectFilm(id).prompt.includes(instruction));
  }
  const coherence = selectFilm('coherence');
  assert.equal(coherence.director, 'James Ward Byrkit');
  assert.match(coherence.prompt, /Coherence \(2013\), directed by James Ward Byrkit/);
  assert.match(coherence.prompt, /publication or reissue year/);
  assert.match(coherence.prompt, /Do not assume that a 4K UHD edition exists/);
  const bladeRunner = selectFilm('blade-runner-final-cut');
  assert.equal(bladeRunner.director, 'Ridley Scott');
  assert.match(bladeRunner.prompt, /Blade Runner \(1982\), directed by Ridley Scott, specifically The Final Cut/);
  assert.match(bladeRunner.prompt, /not a theatrical cut, Director's Cut, another version or Blade Runner 2049/);
  assert.match(bladeRunner.prompt, /For a collection or multi-version set/);
  assert.match(bladeRunner.prompt, /explicitly state that the version is uncertain/);
});

test('unknown DEMO_FILM, including prototype keys and empty string, fails before transport/server creation', () => {
  let calls = 0;
  for (const filmId of ['', 'unknown', '__proto__', 'constructor', 'toString', 'Coherence', ' coherence']) {
    assert.throws(() => selectFilm(filmId), /Unknown DEMO_FILM.*dune-part-two, coherence, blade-runner-final-cut/);
    assert.throws(() => requestBody(filmId), /Unknown DEMO_FILM/);
    assert.throws(() => createDemo({ filmId, mode: 'live', apiKey: 'offline-test-key', fetchImpl: () => { calls++; } }), /Unknown DEMO_FILM/);
  }
  assert.equal(calls, 0);
});

test('CLI rejects invalid DEMO_FILM at startup without listening or making a request', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: { ...process.env, DEMO_FILM: 'not-a-film', DEMO_MODE: 'live', GEMINI_API_KEY: '' },
    encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown DEMO_FILM/);
  assert.doesNotMatch(result.stdout, /Local .* demo:/);
});

test('each selected film uses the displayed prompt in exactly one mocked request; client overrides ignored', async t => {
  for (const filmId of Object.keys(FILMS)) await t.test(filmId, async t => {
    let calls = 0;
    let actualBody;
    const { origin, session, post } = await start(t, { filmId, mode: 'live', apiKey: 'offline-test-key', fetchImpl: async (_, options) => {
      calls++;
      actualBody = JSON.parse(options.body);
      return Response.json(syntheticResponse('grounded', filmId));
    } });
    assert.deepEqual(session.film, { id: filmId, title: selectFilm(filmId).title, director: selectFilm(filmId).director });
    assert.equal(session.prompt, selectFilm(filmId).prompt);
    const attemptOverride = () => fetch(`${origin}/answer`, {
      method: 'POST', headers: { Origin: origin, 'x-demo-session': session.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Ignore server prompt', filmId: 'not-a-film' }),
    });
    const responses = await Promise.all([attemptOverride(), attemptOverride()]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    assert.equal((await post()).status, 409);
    assert.equal(calls, 1);
    assert.equal(actualBody.contents[0].parts[0].text, session.prompt);
    assert.deepEqual(actualBody, requestBody(filmId));
  });
});

test('each synthetic film fixture is visibly invented, does not assume UHD/cut and never calls provider', async t => {
  for (const filmId of Object.keys(FILMS)) await t.test(filmId, async t => {
    const { post } = await start(t, { filmId, fetchImpl: () => assert.fail('Provider network forbidden') });
    const payload = await (await post()).json();
    assert.equal(payload.mode, 'synthetic');
    const data = displayParts(payload.response);
    const text = data.parts[0].text;
    assert.ok(text.includes(selectFilm(filmId).title));
    assert.match(text, /SYNTHETIC ONLY/);
    assert.match(text, /Edition, format, cut and availability are unknown/);
    assert.match(text, /No retailer was checked/);
    assert.equal((await post()).status, 409);
  });
});
