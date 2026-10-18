import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDemo } from '../server.mjs';
import { selectRequest, requestBody, FILMS, AMAZON_REGIONS } from '../config.mjs';
import { KINOBAZA_CARDS } from '../url-context.mjs';
import { syntheticResponse } from '../synthetic.mjs';
import { urlDisplayParts } from '../public/url-display.mjs';

const options = { retrieval: 'url-context', discovery: 'digital-ua', urlSource: 'kinobaza' };

test('22 existing Search/Apple/Kinobaza Gemini bodies remain byte-equivalent to checkpoint a4dbbab', () => {
  const bodies = [];
  for (const id of Object.keys(FILMS)) for (const config of [
    { discovery: 'physical' }, { discovery: 'digital-ua' },
    ...Object.keys(AMAZON_REGIONS).map(amazonRegion => ({ discovery: 'physical', amazonRegion })),
  ]) bodies.push(requestBody(id, config));
  for (const id of ['dune-part-two', 'coherence']) {
    const config = { retrieval: 'url-context', discovery: 'digital-ua' };
    bodies.push(requestBody(id, config));
    assert.deepEqual(requestBody(id, config), requestBody(id, { ...config, urlSource: 'apple-tv' }));
  }
  for (const id of ['dune-part-two', 'coherence']) bodies.push(requestBody(id, { retrieval: 'url-context', discovery: 'digital-ua', urlSource: 'kinobaza' }));
  assert.equal(createHash('sha256').update(JSON.stringify(bodies)).digest('hex'),
    '3b3d76eb5bfaeec3c9921b780a302ab9a91a5dcb383c72e312c35eadee1a7d91');
});

test('fixed Kinobaza source/prompt contract, no expected provider URLs or owner facts', () => {
  assert.deepEqual(KINOBAZA_CARDS, {
    'dune-part-two': 'https://kinobaza.com.ua/titles/dune-part-two',
    coherence: 'https://kinobaza.com.ua/titles/coherence',
  });
  for (const filmId of Object.keys(KINOBAZA_CARDS)) {
    const selection = selectRequest({ ...options, filmId });
    const body = requestBody(filmId, options);
    assert.equal(selection.urlSource, 'kinobaza');
    assert.equal(selection.sourceURL, KINOBAZA_CARDS[filmId]);
    assert.equal(body.contents[0].parts[0].text, selection.prompt);
    assert.deepEqual(body.tools, [{ urlContext: {} }]);
    assert.deepEqual(body.generationConfig, { maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: 'low' } });
    assert.deepEqual(selection.prompt.match(/https?:\/\/\S+/g), [selection.sourceURL]);
    for (const instruction of [selection.film.title, selection.film.director, 'Check identity',
      'viewing/digital-offer section', 'Copy each href exactly', 'redirect/tracking URLs',
      'explicitly Ukrainian section', 'other territories', 'explicitly say unknown',
      'not model memory', 'Do not open, resolve, fetch', 'A link does not establish availability',
      'do not transfer general film localization', 'not structured output']) assert.ok(selection.prompt.includes(instruction));
    assert.doesNotMatch(selection.prompt, /primevideo|tv\.apple|megogo|justwatch|7\.99|3\.99|Dolby 5\.1|MEGOPACK/i);
    const fixture = syntheticResponse('grounded', filmId, options);
    const text = fixture.candidates[0].content.parts[0].text;
    assert.match(text, /SYNTHETIC ONLY/);
    assert.match(text, /No page was retrieved or read/);
    assert.match(text, /hrefs and territories are unknown/);
    assert.doesNotMatch(text, /https?:\/\//);
  }
});

test('unsupported source/combinations reject before listening, never fall back', () => {
  for (const config of [
    { ...options, urlSource: '' }, { ...options, urlSource: '__proto__' },
    { ...options, urlSource: 'https://example.com' }, { ...options, urlSource: 'other' },
    { ...options, discovery: 'physical' }, { ...options, amazonRegion: 'uk' },
    { ...options, filmId: 'blade-runner-final-cut' },
    { ...options, retrieval: 'search' }, { urlSource: 'kinobaza' },
  ]) assert.throws(() => createDemo({ ...config, fetchImpl: () => assert.fail('No network') }));
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: { ...process.env, DEMO_MODE: 'synthetic', DEMO_ACCESS: 'localhost',
      DEMO_RETRIEVAL: 'url-context', DEMO_DISCOVERY: 'digital-ua', DEMO_FILM: 'coherence',
      DEMO_AMAZON_REGION: undefined, DEMO_URL_SOURCE: 'invalid' },
    encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DEMO_URL_SOURCE/);
  assert.doesNotMatch(result.stdout, /Local .* demo/);
});

test('Kinobaza session/source/prompt match one mocked request; no destination requests or overrides', async t => {
  for (const filmId of Object.keys(KINOBAZA_CARDS)) await t.test(filmId, async t => {
    const calls = [];
    const server = createDemo({ ...options, filmId, mode: 'live', apiKey: 'offline-only', fetchImpl: async (url, init) => {
      calls.push({ url, init });
      const response = syntheticResponse('grounded', filmId, options);
      // Invented adversarial output: displayed only, never followed or parsed.
      response.candidates[0].content.parts[0].text += '\nSYNTHETIC candidate: https://example.com/redirect?x=%2F&y=1 — territory unknown, availability unknown.';
      return Response.json(response);
    } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const sessionResponse = await fetch(`${origin}/session`);
    assert.equal(sessionResponse.headers.get('cache-control'), 'no-store');
    const session = await sessionResponse.json();
    assert.equal(calls.length, 0);
    assert.equal(session.urlSource, 'kinobaza');
    assert.equal(session.sourceURL, KINOBAZA_CARDS[filmId]);
    assert.ok(!JSON.stringify(session).includes('offline-only'));
    const post = () => fetch(`${origin}/answer`, { method: 'POST',
      headers: { Origin: origin, 'x-demo-session': session.token },
      body: JSON.stringify({ urlSource: 'apple-tv', sourceURL: 'https://example.com', prompt: 'override' }),
    });
    const replies = await Promise.all([post(), post()]);
    assert.deepEqual(replies.map(r => r.status).sort(), [200, 409]);
    const payload = await replies.find(r => r.status === 200).json();
    assert.equal((await post()).status, 409);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.8-flash:generateContent$/);
    assert.equal(calls[0].init.redirect, 'error');
    const sent = JSON.parse(calls[0].init.body);
    assert.deepEqual(sent, requestBody(filmId, options));
    assert.equal(sent.contents[0].parts[0].text, session.prompt);
    const shown = urlDisplayParts(payload.response, session.sourceURL);
    assert.equal(shown.text, payload.response.candidates[0].content.parts[0].text);
    assert.match(shown.text, /x=%2F&y=1/);
  });
});

test('Kinobaza retrieval success/error/missing/unknown metadata never becomes offer verification', () => {
  for (const scenario of ['grounded', 'retrieval-error', 'retrieval-paywall', 'retrieval-unsafe', 'ungrounded', 'future']) {
    const response = syntheticResponse(scenario === 'future' ? 'grounded' : scenario, 'coherence', options);
    if (scenario === 'future') response.candidates[0].urlContextMetadata.urlMetadata[0].urlRetrievalStatus = 'FUTURE';
    const data = urlDisplayParts(response, KINOBAZA_CARDS.coherence);
    assert.equal(data.matchingSuccess, scenario === 'grounded');
    assert.equal(data.text, response.candidates[0].content.parts[0].text);
    assert.match(data.notice, scenario === 'grounded' ? /Not proof of truth/ : /NOT established/);
  }
});
