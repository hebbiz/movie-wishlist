import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaAdviceHandler } from '../netlify/functions/media-advice.mjs';
import { productMediaResult, mediaCapabilities } from '../netlify/lib/media-advice-response.mjs';
import { presentMediaGroups } from '../assets/media-advice-presentation.mjs';
import { linkChoicesFor, makePreview } from '../assets/media-advice.mjs';
import { authoredDuneMediaResult, authoredGroupedMediaRows } from './media-advice-group.fixture.mjs';

const user = '00000000-0000-4000-8000-000000000001', group = '00000000-0000-4000-8000-000000000002';
const caps = diagnostics => ({ mykola_media_advice: true, mykola_media_advice_diagnostics: diagnostics });
const request = (extra = {}) => new Request('https://app.example/.netlify/functions/media-advice', { method: 'POST',
  headers: { origin: 'https://app.example', authorization: 'Bearer AUTHORED', 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'discover', groupId: group, formSession: user, imdbId: 'tt1234567', ...extra }) });
const fullResult = () => ({ film: { id: 'imdb:tt1234567', imdbId: 'tt1234567', title: 'Authored film', year: 2024 },
  rows: [{ id: 'motn:1', filmId: 'imdb:tt1234567', identityStatus: 'matched', provider: { key: 'apple' }, country: 'UA',
    provenance: { source: 'Movie of the Night', sourceURL: 'PRIVATE_SOURCE_URL', method: 'PRIVATE_METHOD' },
    rawHref: 'PRIVATE_RAW_HREF', link: { href: 'https://itunes.apple.com/ua/movie/id123' },
    audio: { state: 'reported', ukrainian: [{ language: 'ukr' }] }, subtitles: { state: 'unknown' },
    quality: { state: 'reported', value: 'PRIVATE_QUALITY' }, conflicts: [], rawResponse: 'PRIVATE_RAW_RESPONSE' }],
  resolver: { status: 'bounded-unresolved', cards: [{ reason: 'PRIVATE_GATE' }] },
  metrics: { requestsMade: 8, calls: [{ stage: 'PRIVATE_STAGE' }] }, runtime: { runId: 'PRIVATE_RUN' },
  sources: [{ source: 'tmdb', status: 'partial', diagnostics: 'PRIVATE_DIAGNOSTICS' }],
  unmapped: [{ name: 'Plex', observations: [{ raw: 'PRIVATE_UNMAPPED' }] }], raw: 'PRIVATE_ENVELOPE' });

test('ordinary Beta response withholds diagnostics even with forged browser flags/region/user metadata', async () => {
  const operations = [], client = { auth: { getUser: async () => ({ data: { user: { id: user,
    user_metadata: { region: 'UA', mykola_media_advice_diagnostics: true } } } }) },
    rpc: async (name, args) => { assert.equal(name, 'media_advice_beta_action'); operations.push(args);
      return { data: { id: user, attempts: [], ...caps(false) } }; } };
  const response = await createMediaAdviceHandler({ client, env: () => '', run: async () => fullResult() })(request({
    region: 'UA', diagnostics: true, mykola_media_advice_diagnostics: true, userId: group, role: 'owner' }));
  assert.equal(response.status, 200); const payload = await response.json();
  assert.deepEqual(payload.result.capabilities, caps(false)); assert.equal(payload.result.rows[0].link.href, 'https://itunes.apple.com/ua/movie/id123');
  assert.equal(payload.result.rows[0].audio.ukrainian[0].language, 'ukr');
  assert.equal(payload.result.sources[0].status, 'partial'); assert.deepEqual(payload.result.unmapped, [{ name: 'Plex' }]);
  assert.doesNotMatch(JSON.stringify(payload), /PRIVATE_|resolver|metrics|runtime|rawHref|sourceURL|"diagnostics":/);
  assert.deepEqual(operations.map(op => op.p_op), ['start', 'finish']);
  assert.ok(operations.every(op => op.p_user === user && op.p_group === group));
  assert.doesNotMatch(JSON.stringify(operations), /diagnostics|region|owner/);
});

test('diagnostics require fresh server permission; revoking only diagnostics does not revoke ordinary advice', async () => {
  for (const allowed of [true, false]) {
    const client = { auth: { getUser: async () => ({ data: { user: { id: user } } }) },
      rpc: async (_, args) => ({ data: { id: user, attempts: [], ...caps(args.p_op === 'finish' ? allowed : true) } }) };
    const response = await createMediaAdviceHandler({ client, env: () => '', run: async () => fullResult() })(request());
    assert.equal(response.status, 200); const payload = await response.json();
    assert.equal(payload.result.capabilities.mykola_media_advice_diagnostics, allowed);
    assert.equal(JSON.stringify(payload).includes('PRIVATE_GATE'), allowed);
    assert.equal(payload.result.rows[0].link.href, 'https://itunes.apple.com/ua/movie/id123');
  }
});

test('capability returns only effective booleans; client cannot request a diagnostic bypass or self-grant', async () => {
  for (const allowed of [true, false]) {
    const client = { auth: { getUser: async () => ({ data: { user: { id: user } } }) },
      rpc: async () => ({ data: { ...caps(true), mykola_media_advice: allowed, region: 'PRIVATE_REGION', userId: 'PRIVATE_ID' } }) };
    const handler = createMediaAdviceHandler({ client, env: () => '', run: () => assert.fail('capability must not discover') });
    const response = await handler(request({ action: 'capability', mykola_media_advice: true }));
    assert.equal(response.status, allowed ? 200 : 403);
    if (allowed) assert.deepEqual(await response.json(), caps(true));
    else assert.doesNotMatch(await response.text(), /PRIVATE_|diagnostics/);
    assert.equal((await handler(request({ action: 'diagnostics' }))).status, 400);
  }
  assert.deepEqual(mediaCapabilities({ mykola_media_advice: false, mykola_media_advice_diagnostics: true }), { mykola_media_advice: false, mykola_media_advice_diagnostics: false });
});

test('final access revocation withholds even product-only data and does not return a failed finish result', async () => {
  const client = { auth: { getUser: async () => ({ data: { user: { id: user } } }) },
    rpc: async (_, args) => args.p_op === 'finish' ? { error: true } : { data: { id: user, ...caps(false) } } };
  const response = await createMediaAdviceHandler({ client, env: () => '', run: async () => fullResult() })(request());
  assert.equal(response.status, 403); assert.doesNotMatch(await response.text(), /Authored film|itunes|PRIVATE_/);
});

test('public projection preserves ranking, source-language interpretation, Apple origin preference and exact transfer without mutation', async () => {
  for (const result of [await authoredDuneMediaResult(), { rows: authoredGroupedMediaRows() }]) {
    const before = JSON.stringify(result), projected = productMediaResult(result, caps(false));
    const view = value => presentMediaGroups(value.rows, { filmId: value.film?.id }).map(info => ({ key: info.group.key,
      band: info.band, comparison: info.comparison, links: linkChoicesFor(info).map(link => link.href) }));
    assert.deepEqual(view(projected), view(result)); assert.equal(JSON.stringify(result), before);
    for (const info of presentMediaGroups(projected.rows, { filmId: projected.film?.id })) for (const link of linkChoicesFor(info)) {
      assert.equal(makePreview(link.row, { recommended_medium: '', purchase_url: '' }).after.purchase_url, link.href);
    }
    assert.doesNotMatch(JSON.stringify(projected), /rawHref|sourceURL|receivedAt|runtime|metrics|resolver|amount|PRICE_SENTINEL/);
  }
});
