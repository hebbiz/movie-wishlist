import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { movies, argumentsFor, tmdbIdentity, run } from '../cli.mjs';
import { syntheticResponse } from '../fixtures/synthetic.mjs';
import { normalize, parseResponse } from '../evidence.mjs';
import { groundedSearch, requestBody, redact, costEstimate } from '../gemini.mjs';

const now = '2026-10-17T20:00:00Z';
const value = (result, listing, field) => result.listings[listing].claims.find(c => c.field === field);
const norm = (index, reviews = [], mode = 'offline') => normalize(syntheticResponse(movies[index]), movies[index], { mode, reviews, retrievedAt: now });
function alter(index, callback) {
  const raw = syntheticResponse(movies[index]);
  const doc = JSON.parse(raw.candidates[0].content.parts[0].text);
  callback(doc);
  const text = JSON.stringify(doc);
  raw.candidates[0].content.parts[0].text = text;
  raw.candidates[0].groundingMetadata.groundingSupports.forEach(s => s.segment.text = text);
  return raw;
}
const review = (field, v, extras = {}) => ({ listingId: 'synthetic-uk-stream', field, value: v,
  sourceUrl: 'https://tv.apple.com/gb/synthetic/not-a-film', editionUrl: 'https://tv.apple.com/gb/synthetic/not-a-film',
  sourceKind: 'page_content', reviewer: 'TEST ONLY - NOT REAL HUMAN VALIDATION', checkedAt: now,
  excerpt: v, evidenceNote: 'Synthetic test evidence, not a live page.', ...extras });

test('all three fixtures normalize and retain all twelve checked/unobserved sources', () => {
  for (let i = 0; i < 3; i++) {
    const result = norm(i);
    assert.equal(result.mode, 'offline');
    assert.equal(result.checkedSources.length, 12);
    assert.equal(result.metrics.confirmedClaimsHumanVerified, 0);
    assert.equal(result.metrics.usableOffers, 0);
  }
});
test('unsupported source cannot become confirmed or likely', () => {
  const claim = value(norm(0), 0, 'uhd.hdr');
  assert.equal(claim.reportedValue, 'Dolby Vision');
  assert.equal(claim.confidence, 'unknown');
  assert.equal(claim.value, null);
});
test('URL absent from grounding is not a usable source just because model cites it', () => {
  const raw = alter(0, doc => { doc.listings[0].claims[1].sourceUrls = ['https://www.amazon.co.uk/another-product']; });
  const result = normalize(raw, movies[0]);
  assert.equal(value(result, 0, 'availability').confidence, 'unknown');
});
test('grounding link without field support is unknown', () => {
  const raw = syntheticResponse(movies[0]);
  raw.candidates[0].groundingMetadata.groundingSupports = [];
  assert.equal(value(normalize(raw, movies[0]), 0, 'availability').confidence, 'unknown');
});
test('UK streaming is not availability in Ukraine', () => {
  const listing = norm(0).listings[1];
  assert.equal(listing.availability, 'unknown');
  assert.equal(listing.availabilityConfidence, 'unknown');
  assert.equal(listing.claims[0].territory.country, null);
});
test('UA model assertion or localized URL alone cannot confirm streaming', () => {
  const raw = alter(0, doc => { doc.listings[1].claims[2].value = 'UA'; });
  const result = normalize(raw, movies[0], { mode: 'live', retrievedAt: now,
    reviews: [review('availability', 'available'), review('territory', 'UA', { territoryBasis: 'url_locale', territoryCountry: 'UA' })] });
  assert.equal(result.listings[1].availability, 'unknown');
});
test('fresh explicit primary page review can confirm a field, without auto-confirming other fields', () => {
  const result = normalize(syntheticResponse(movies[0]), movies[0], { mode: 'live', retrievedAt: now,
    reviews: [review('availability', 'available'), review('territory', 'UA', { territoryBasis: 'explicit_entitlement', territoryCountry: 'UA' })] });
  // The model reported GB, so the UA review is not silently substituted into it.
  assert.equal(result.listings[1].availability, 'unknown');
  const raw = alter(0, doc => { doc.listings[1].claims[2].value = 'UA'; });
  const confirmed = normalize(raw, movies[0], { mode: 'live', retrievedAt: now,
    reviews: [review('availability', 'available'), review('territory', 'UA', { territoryBasis: 'explicit_entitlement', territoryCountry: 'UA' })] });
  assert.equal(confirmed.listings[1].availabilityConfidence, 'confirmed');
  assert.equal(confirmed.listings[1].usableOffer, false); // Identity has not been manually reviewed.
});
test('synthetic mode never counts fake manual review as human verified', () => {
  assert.equal(norm(0, [review('availability', 'available')]).metrics.confirmedClaimsHumanVerified, 0);
});
test('expired review or copied evidence from another edition cannot confirm', () => {
  const raw = alter(0, doc => { doc.listings[1].claims[2].value = 'UA'; });
  for (const extra of [{ checkedAt: '2025-01-01' }, { editionUrl: 'https://tv.apple.com/another-edition' }]) {
    const r = normalize(raw, movies[0], { mode: 'live', retrievedAt: now,
      reviews: [review('availability', 'available', extra)] });
    assert.notEqual(value(r, 1, 'availability').confidence, 'confirmed');
  }
});
test('Sold out plus a price is not available', () => {
  const result = norm(1);
  assert.equal(result.listings[0].availability, 'unknown');
  assert.equal(value(result, 0, 'availability').conflict, true);
  assert.equal(value(result, 0, 'price').value, '12.99');
});
test('contradictory language-specific audio claims remain conflict/unknown', () => {
  const claim = value(norm(1), 0, 'bluray.audio.uk.codec');
  assert.equal(claim.conflict, true);
  assert.equal(claim.confidence, 'unknown');
  assert.match(claim.evidenceNote, /Conflicting/);
  assert.equal(claim.reportedValues.length, 2);
});
test('wrong Blade Runner cut rejected; edition-year difference alone retained', () => {
  const result = norm(2);
  assert.equal(result.listings[0].cutMismatch, true);
  assert.equal(result.listings[0].usableOffer, false);
  assert.equal(result.listings[1].cutMismatch, false);
  assert.equal(value(result, 1, 'listing_year').value, '2007');
});
test('different IMDb identifier is a conflict even if title/year match', () => {
  const raw = alter(0, doc => { doc.listings[0].claims[0].value = 'tt99999999'; });
  const result = normalize(raw, movies[0]);
  assert.equal(result.listings[0].identityMismatch, true);
  assert.equal(value(result, 0, 'movie_identity').confidence, 'unknown');
});
test('no listings is unknown coverage, never unavailable', () => {
  const raw = alter(0, doc => { doc.listings = []; });
  const result = normalize(raw, movies[0]);
  assert.deepEqual(result.listings, []);
  assert.equal(result.metrics.usableOffers, 0);
});
test('no silent mixing of bundle discs or original-language inference', () => {
  const r = norm(0);
  assert.equal(value(r, 0, 'audio').confidence, 'unknown');
  assert.equal(value(r, 0, 'subtitles').confidence, 'unknown');
  assert.equal(value(r, 0, 'hdr').confidence, 'unknown');
  assert.equal(value(r, 0, 'uhd.hdr').confidence, 'unknown');
});
test('malformed, truncated, unsafe URL, wrong movie and extra API fields fail closed', () => {
  for (const raw of [null, {}, { candidates: [{ finishReason: 'MAX_TOKENS' }] },
    alter(0, doc => { doc.movieId = 'other'; }), alter(0, doc => { doc.extra = true; }),
    alter(0, doc => { doc.listings[0].url = 'https://www.amazon.co.uk.attacker.example/p'; }),
    alter(0, doc => { doc.listings[0].claims[0].sourceUrls = 'not array'; })]) {
    assert.throws(() => parseResponse(raw, movies[0]));
  }
});
test('maximum two HTTP attempts, one retry on transient status', async () => {
  let count = 0;
  const records = [];
  const result = await groundedSearch({ model: 'gemini-3.8-flash', key: 'test-secret', body: {}, sleep: async () => {},
    saveAttempt: async r => records.push(r), fetchImpl: async () => new Response(JSON.stringify(count++ ? syntheticResponse(movies[0]) : { error: 'test-secret' }), { status: count === 1 ? 503 : 200 }) });
  assert.equal(result.attempts.length, 2);
  assert.equal(records[0].raw.error, '[REDACTED]');
});
test('persistent transient error stops after two attempts', async () => {
  let count = 0;
  await assert.rejects(groundedSearch({ model: 'gemini-3.8-flash', key: 'test', body: {}, sleep: async () => {},
    fetchImpl: async () => { count++; return new Response('{}', { status: 429 }); } }));
  assert.equal(count, 2);
});
test('400, timeout and transport errors never trigger retry', async () => {
  for (const transport of [async () => new Response('{}', { status: 400 }), async () => { throw new Error('test-secret'); }]) {
    let count = 0;
    await assert.rejects(groundedSearch({ model: 'gemini-3.8-flash', key: 'test-secret', body: {},
      fetchImpl: async (...args) => { count++; return transport(...args); } }), error => !error.message.includes('test-secret'));
    assert.equal(count, 1);
  }
});
test('invalid success body is preserved and not retried or treated as valid results', async () => {
  let count = 0;
  const result = await groundedSearch({ model: 'gemini-3.8-flash', key: 'test', body: {},
    fetchImpl: async () => { count++; return new Response('not JSON'); } });
  assert.equal(count, 1);
  assert.throws(() => parseResponse(result.raw, movies[0]));
});
test('pricing is partial; absent usage/query telemetry never becomes exact or zero', () => {
  const raw = { usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 100, thoughtsTokenCount: 20 } };
  const estimate = costEstimate(raw, 'gemini-3.8-flash', 'live', now);
  assert.equal(estimate.estimatedTokenUsd, 0.0012);
  assert.equal(estimate.estimatedTotalUsd, null);
  assert.equal(estimate.actualInternalSearchCount, null);
  assert.equal(costEstimate({}, 'gemini-3.8-flash', 'live', now).estimatedTokenUsd, null);
  assert.equal(costEstimate(raw, 'other-model', 'live', now).estimatedTokenUsd, null);
  assert.equal(costEstimate(raw, 'gemini-3.8-flash', 'offline', now).estimatedTokenUsd, null);
  assert.equal(costEstimate(raw, 'gemini-3.8-flash', 'live', '2027-01-01').estimatedTokenUsd, null);
});
test('redaction removes configured secret and URL credentials from nested raw content', () => {
  const result = redact({ text: 'SECRET-VALUE', url: 'https://x.test/?api_key=abc&v=1' }, ['SECRET-VALUE']);
  assert.equal(result.text, '[REDACTED]');
  assert.doesNotMatch(result.url, /abc/);
});
test('CLI validates flags; request uses grounded structured output without obsolete sampling options', () => {
  assert.equal(argumentsFor([]).mode, 'dry-run');
  assert.throws(() => argumentsFor(['--movie', 'bad']));
  assert.throws(() => argumentsFor(['--mode', 'live', '--repeat', '5']));
  const body = requestBody('test');
  assert.deepEqual(body.tools, [{ googleSearch: {} }]);
  assert.equal(body.generationConfig.temperature, undefined);
  assert.equal(body.generationConfig.responseFormat.text.mimeType, 'application/json');
});
test('optional TMDb checks identities via one separately counted request; year mismatch alone is allowed', async () => {
  const result = await tmdbIdentity(movies[1], 'FAKE-TMDB-KEY', async () => new Response(JSON.stringify({
    id: 220289, release_date: '2014-06-25', external_ids: { imdb_id: 'tt2866360' },
    credits: { crew: [{ job: 'Director', name: 'James Ward Byrkit' }] },
  })));
  assert.equal(result.status, 'matched');
  assert.equal(result.calls, 1);
});
test('prompt explicitly excludes shipping and forbids cross-edition/audio/territory inference', async () => {
  const prompt = await readFile(new URL('../prompts/media-discovery-v1.txt', import.meta.url), 'utf8');
  for (const term of ['delivery', 'Ukrainian Atmos', 'between stores', 'Ukraine', 'not_checked', 'The Final Cut']) assert.ok(prompt.includes(term));
});
test('live mode without credential writes blocked records for all films and makes zero calls', async () => {
  let calls = 0;
  const result = await run({ mode: 'live', movie: 'all' }, {}, { search: async () => { calls++; throw new Error('must not run'); } });
  assert.equal(result.blocked, true);
  assert.equal(calls, 0);
  assert.equal(result.records.length, 3);
  assert.ok(result.records.every(r => r.status === 'blocked: missing GEMINI_API_KEY' && r.httpAttempts === 0));
});
test('invalid pilot stops batch before later film calls (injected test transport only)', async () => {
  let calls = 0;
  const result = await run({ mode: 'live', movie: 'all' }, {
    GEMINI_API_KEY: 'FAKE-TEST-KEY', GEMINI_MODEL: 'gemini-3.8-flash', GEMINI_GROUNDING_PERMISSION_REF: 'TEST-NOT-A-REAL-GRANT',
  }, { search: async ({ saveAttempt }) => {
    calls++;
    const attempt = { attempt: 1, status: 200, elapsedMs: 0, raw: { testOnly: true, invalid: true } };
    await saveAttempt(attempt);
    return { raw: attempt.raw, attempts: [attempt] };
  } });
  assert.equal(calls, 1);
  assert.equal(result.failed, true);
  assert.deepEqual(result.records.map(r => r.status), ['error', 'not_run_after_failed_pilot', 'not_run_after_failed_pilot']);
});
test('local review CLI preserves source time and makes no new calls; synthetic transport fixture only', async () => {
  const root = fileURLToPath(new URL('../runs/', import.meta.url));
  const source = join(root, `test-${randomUUID()}-synthetic-review-source`);
  await mkdir(source, { recursive: true });
  const raw = syntheticResponse(movies[0]);
  delete raw.synthetic;
  raw.modelVersion = 'MOCK-API-TEST-NOT-LIVE';
  const stamp = new Date().toISOString();
  const original = normalize(raw, movies[0], { mode: 'live', retrievedAt: stamp });
  const url = original.listings[0].url;
  const reviews = ['movie_identity', 'availability', 'format'].map(field => {
    const reported = original.listings[0].claims.find(c => c.field === field).reportedValue;
    return { listingId: original.listings[0].id, field, value: reported, sourceUrl: url, editionUrl: url,
      sourceKind: 'page_content', reviewer: 'SYNTHETIC TEST ONLY', checkedAt: stamp, excerpt: reported,
      evidenceNote: 'Not a human observation; integration test.' };
  });
  await writeFile(join(source, 'manifest.json'), JSON.stringify({ mode: 'live', liveGate: null, selected: [movies[0].id], testOnly: true }));
  await writeFile(join(source, `${movies[0].id}.normalized.json`), JSON.stringify(original));
  await writeFile(join(source, `${movies[0].id}.raw-attempt-1.json`), JSON.stringify({ status: 200, raw }));
  const reviewsPath = join(source, 'reviews.json');
  await writeFile(reviewsPath, JSON.stringify(reviews));
  const { stdout } = await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../review.mjs', import.meta.url)),
    '--run', source, '--reviews', reviewsPath], { env: { SystemRoot: process.env.SystemRoot,
    GEMINI_GROUNDING_PERMISSION_REF: 'SYNTHETIC TEST ONLY - NO API REQUEST' } });
  const result = JSON.parse(stdout);
  assert.equal(result.applicationCalls, 0);
  assert.equal(result.humanConfirmedClaims, 3); // Mock review behavior, never research findings.
  const after = JSON.parse(await readFile(join(result.output, `${movies[0].id}.normalized.json`), 'utf8'));
  assert.equal(after.retrievedAt, original.retrievedAt);
  assert.ok(after.sourceNormalizedSha256);
  assert.equal(after.listings[0].usableOffer, true);
});
