import test from 'node:test';
import assert from 'node:assert/strict';
import { makePreview, applyPreview, transferFor } from '../assets/media-advice.mjs';
export const authoredRow = (href = 'https://tv.apple.com/ua/movie/authored/umc.cmc.authored') => ({
  id: 'motn:authored', identityStatus: 'matched', provider: { key: 'apple', name: 'Apple TV Store' },
  country: 'UA', access: { state: 'reported', value: 'rental' }, provenance: { source: 'AUTHORED MOTN' }, link: { href },
});
test('only approved form fields, exact href, no title/status/ownership transfer', () => {
  const form = { recommended_medium: 'DVD', purchase_url: 'https://old.example/' };
  const p = makePreview(authoredRow(), form);
  assert.deepEqual(Object.keys(p.after), ['recommended_medium', 'purchase_url']);
  assert.deepEqual(applyPreview(p, form), p.after);
  assert.equal(applyPreview(p, { ...form, purchase_url: 'manual-edit' }), null);
});
test('missing URL never silently combines new medium with old URL', () => {
  const form = { recommended_medium: 'DVD', purchase_url: 'https://old.example/' };
  assert.equal(makePreview(authoredRow(null), form), null);
  assert.equal(makePreview(authoredRow(null), form, { clearMissing: true }).after.purchase_url, '');
});
test('R1 Apple at presence including empty/repeated and tracking acknowledgement', () => {
  for (const href of ['https://itunes.apple.com/ua/movie/id123?at=&at=x', 'https://tv.apple.com/ua/movie/authored/umc.cmc.authored?at=token%2F', 'https://click.justwatch.com/a?x=%2F']) {
    assert.equal(transferFor(authoredRow(href)).blocked, true);
    assert.equal(transferFor(authoredRow(href), true).url, href);
  }
  assert.equal(transferFor(authoredRow()).needsAck, false);
});
test('unresolved, conflicting provider, unknown platform and unsafe href cannot transfer', () => {
  assert.equal(transferFor({ ...authoredRow(), identityStatus: 'unresolved' }), null);
  assert.equal(transferFor({ ...authoredRow(), providerConflict: true }), null);
  assert.equal(transferFor({ ...authoredRow(), provider: { key: 'plex' } }), null);
  assert.equal(transferFor({ ...authoredRow(), provider: { key: '__proto__' } }), null);
  for (const href of ['javascript:alert(1)', 'https://x@tv.apple.com/ua/movie/x/umc.cmc.a', 'https://tv.apple.com:444/ua/movie/x/umc.cmc.a', '/relative', 'https://netflix.com/search?q=x']) assert.equal(transferFor(authoredRow(href)).url, null);
});
