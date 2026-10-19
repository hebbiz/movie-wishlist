import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDemo } from '../server.mjs';
import { syntheticResponse } from '../synthetic.mjs';
import { displayParts, byteIndex, once } from '../public/display.mjs';
import { MODEL, MAX_OUTPUT_TOKENS, PROMPT, DEFAULT_FILM, FILMS, AMAZON_REGIONS, selectFilm, selectScenario, requestBody } from '../config.mjs';

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
  assert.equal(session.discovery, 'physical');
  assert.equal(session.amazonRegion, null);
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

test('README documents every server switch and unchanged output limit', async () => {
  const readme = (await readFile(new URL('../README.md', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  for (const name of ['DEMO_FILM', 'DEMO_DISCOVERY', 'DEMO_AMAZON_REGION', 'maxOutputTokens=4096']) assert.ok(readme.includes(name));
});

test('default film and physical multi-store selection are preserved', () => {
  assert.equal(DEFAULT_FILM, 'dune-part-two');
  assert.equal(selectFilm().id, DEFAULT_FILM);
  assert.equal(selectScenario().prompt, PROMPT);
  assert.equal(selectScenario().discovery, 'physical');
  assert.equal(selectScenario().amazonRegion, null);
  assert.match(PROMPT, /Look at HMV, Rarewaves, and Amazon US, UK, Germany and Italy/);
  assert.match(PROMPT, /Treat all four Amazon regions equally/);
  assert.deepEqual(requestBody(), requestBody(DEFAULT_FILM));
});

test('fixed catalogue identifies the films and preserves model/settings for every film', () => {
  assert.deepEqual(Object.keys(FILMS), ['dune-part-two', 'coherence', 'blade-runner-final-cut']);
  assert.equal(MODEL, 'gemini-3.8-flash');
  assert.equal(MAX_OUTPUT_TOKENS, 4096);
  for (const id of Object.keys(FILMS)) {
    const body = requestBody(id);
    assert.equal(body.contents[0].parts[0].text, selectScenario({ filmId: id }).prompt);
    assert.deepEqual(body.tools, [{ googleSearch: {} }]);
    assert.deepEqual(body.generationConfig, { maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: 'low' } });
    for (const instruction of PROMPT.split('\n').slice(1)) assert.ok(selectScenario({ filmId: id }).prompt.includes(instruction));
  }
  const coherence = { ...selectFilm('coherence'), prompt: selectScenario({ filmId: 'coherence' }).prompt };
  assert.equal(coherence.director, 'James Ward Byrkit');
  assert.match(coherence.prompt, /Coherence \(2013\), directed by James Ward Byrkit/);
  assert.match(coherence.prompt, /publication or reissue year/);
  assert.match(coherence.prompt, /Do not assume that a UHD edition exists/);
  const bladeRunner = { ...selectFilm('blade-runner-final-cut'), prompt: selectScenario({ filmId: 'blade-runner-final-cut' }).prompt };
  assert.equal(bladeRunner.director, 'Ridley Scott');
  assert.match(bladeRunner.prompt, /Blade Runner \(1982\) — The Final Cut, directed by Ridley Scott/);
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
    assert.equal(session.prompt, selectScenario({ filmId }).prompt);
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

const selections = Object.keys(FILMS).flatMap(filmId => [
  { filmId, discovery: 'physical' },
  ...Object.keys(AMAZON_REGIONS).map(amazonRegion => ({ filmId, discovery: 'physical', amazonRegion })),
  { filmId, discovery: 'digital-ua' },
]);

test('all 18 film/mode/region configurations: displayed/request prompt, fixed settings, one-shot and no browser override', async t => {
  for (const selection of selections) await t.test(JSON.stringify(selection), async t => {
    const expected = selectScenario(selection);
    let calls = 0;
    let actualBody;
    const { session, origin, post } = await start(t, { ...selection, mode: 'live', apiKey: 'offline-test-key', fetchImpl: async (_, options) => {
      calls++;
      actualBody = JSON.parse(options.body);
      return Response.json(syntheticResponse('grounded', selection.filmId, selection));
    } });
    assert.equal(session.discovery, expected.discovery);
    assert.equal(session.amazonRegion, expected.amazonRegion);
    assert.equal(session.prompt, expected.prompt);
    const attemptOverride = () => fetch(`${origin}/answer`, {
      method: 'POST', headers: { Origin: origin, 'x-demo-session': session.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'arbitrary', filmId: 'unknown', discovery: 'invalid', amazonRegion: 'fr' }),
    });
    const results = await Promise.all([attemptOverride(), attemptOverride()]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    assert.equal((await post()).status, 409);
    assert.equal(calls, 1);
    assert.equal(actualBody.contents[0].parts[0].text, session.prompt);
    assert.deepEqual(actualBody, requestBody(selection.filmId, selection));
    assert.deepEqual(actualBody.generationConfig, { maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: 'low' } });
    const fixture = displayParts(syntheticResponse('grounded', selection.filmId, selection));
    assert.match(fixture.parts[0].text, /SYNTHETIC ONLY/);
    assert.match(fixture.parts[0].text, /Ukrainian viewing availability, Ukrainian audio and Ukrainian subtitles are unknown/);
    assert.match(fixture.parts[0].text, /No platform was checked/);
  });
});

const invalidSelections = [
  ...['', 'digital', '__proto__', 'Digital-UA'].map(discovery => ({ discovery })),
  ...['', 'fr', 'US', '__proto__', null].map(amazonRegion => ({ amazonRegion })),
  ...Object.keys(AMAZON_REGIONS).map(amazonRegion => ({ discovery: 'digital-ua', amazonRegion })),
];
test('unknown switches and Amazon regions in digital-ua are rejected before server/transport', () => {
  let calls = 0;
  for (const selection of invalidSelections) {
    assert.throws(() => selectScenario(selection), /DEMO_DISCOVERY|DEMO_AMAZON_REGION/);
    assert.throws(() => requestBody(DEFAULT_FILM, selection), /DEMO_DISCOVERY|DEMO_AMAZON_REGION/);
    assert.throws(() => createDemo({ ...selection, mode: 'live', apiKey: 'offline-test-key', fetchImpl: () => { calls++; } }), /DEMO_DISCOVERY|DEMO_AMAZON_REGION/);
  }
  assert.equal(calls, 0);
});

test('CLI rejects invalid discovery/region environment before listening', () => {
  for (const env of [
    { DEMO_DISCOVERY: 'unknown', DEMO_AMAZON_REGION: 'us' },
    { DEMO_DISCOVERY: 'physical', DEMO_AMAZON_REGION: 'fr' },
    { DEMO_DISCOVERY: 'digital-ua', DEMO_AMAZON_REGION: 'uk' },
  ]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
      env: { ...process.env, ...env, DEMO_FILM: DEFAULT_FILM, DEMO_MODE: 'live', DEMO_PORT: '4317', GEMINI_API_KEY: '' }, encoding: 'utf8', timeout: 5000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /DEMO_DISCOVERY|DEMO_AMAZON_REGION/);
    assert.doesNotMatch(result.stdout, /Local .* demo:/);
  }
});

test('physical prompt scope and priorities, Marketplace, disc identity and stock caveats are explicit', () => {
  for (const selection of selections.filter(s => s.discovery === 'physical')) {
    const { prompt } = selectScenario(selection);
    assert.match(prompt, /availability, then English audio, then 4K UHD Blu-ray \/ Blu-ray \/ DVD/);
    assert.match(prompt, /Marketplace offers are allowed, not only Amazon-direct or Amazon-fulfilled/);
    assert.match(prompt, /State seller and condition if known/);
    assert.match(prompt, /Do not assume Amazon is the seller/);
    assert.match(prompt, /sold-out price is not a successful available offer/);
    assert.match(prompt, /must not be called historical without evidence/);
    assert.match(prompt, /Distinguish UHD disc characteristics from the bundled Blu-ray/);
    assert.match(prompt, /each citation refers to the exact film, cut, edition and offer/);
    if (selection.amazonRegion) {
      assert.ok(prompt.includes(`Search only the Amazon store ${AMAZON_REGIONS[selection.amazonRegion]}`));
      assert.deepEqual(prompt.match(/amazon\.(?:co\.uk|com|de|it)/g), [AMAZON_REGIONS[selection.amazonRegion]]);
      assert.doesNotMatch(prompt, /Look at HMV/);
    }
  }
});

test('digital prompts specify UA/locale evidence, separate claims, priorities, unknowns and Final Cut', () => {
  for (const filmId of Object.keys(FILMS)) {
    const { prompt } = selectScenario({ filmId, discovery: 'digital-ua' });
    assert.match(prompt, /Apple TV, Rakuten TV, Netflix, Prime Video, MEGOGO and HBO Max \(formerly Max\)/);
    const order = ['1. Ability to watch', '2. Ukrainian audio', '3. Ukrainian subtitles', '4. Video format', '5. Access type'];
    const indices = order.map(text => prompt.indexOf(text));
    assert.ok(indices.every(i => i >= 0));
    assert.deepEqual(indices, [...indices].sort((a, b) => a - b));
    for (const text of ['confirmed presence, confirmed absence and unknown', 'country-code URL alone does not confirm', 'negative search result is not proof', 'keep availability unknown', 'Do not transfer global or foreign-market', 'do not substitute subtitles for audio', '4K does not prove HDR10 or Dolby Vision', 'HD with Ukrainian audio over 4K', 'prefer Ukrainian subtitles over a better video format', 'subscription, rental or purchase']) assert.ok(prompt.includes(text));
    assert.doesNotMatch(prompt, /Look at HMV|Search only the Amazon store/);
    if (filmId === 'blade-runner-final-cut') assert.match(prompt, /not a theatrical cut, Director's Cut, another version or Blade Runner 2049/);
  }
});
