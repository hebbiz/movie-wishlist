import test from 'node:test';
import assert from 'node:assert/strict';
import { makePreview, applyPreview, transferFor, linkPreview } from '../assets/media-advice.mjs';
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
  assert.equal(applyPreview(p, { ...form, recommended_medium: 'manual-medium' }), null);
});
test('missing URL never silently combines new medium with old URL', () => {
  const form = { recommended_medium: 'DVD', purchase_url: 'https://old.example/' };
  assert.equal(makePreview(authoredRow(null), form), null);
  assert.equal(makePreview(authoredRow(null), form, { clearMissing: true }).after.purchase_url, '');
});
test('M4 transfers admitted tracking/referral URLs without a separate acknowledgement, preserving R1 classification and literal href', () => {
  for (const href of ['https://itunes.apple.com/ua/movie/id123?at=&at=x', 'https://tv.apple.com/ua/movie/authored/umc.cmc.authored?at=token%2F', 'https://click.justwatch.com/a?x=%2F#exact']) {
    const transfer = transferFor(authoredRow(href));
    assert.equal(transfer.url, href);
    assert.equal(transfer.link.transferable, true);
    assert.ok(transfer.link.acknowledgementRequired || transfer.link.kind === 'tracking-redirect', 'shared classification still describes the observed link');
    const form = { recommended_medium: 'DVD', purchase_url: 'https://old.example/' };
    const preview = makePreview(authoredRow(href), form);
    assert.equal(preview.rowId, 'motn:authored'); assert.equal(preview.after.purchase_url, href);
    assert.deepEqual(applyPreview(preview, form), { recommended_medium: 'Apple TV / iTunes', purchase_url: href });
  }
  assert.equal(transferFor(authoredRow()).url, authoredRow().link.href);
});

test('compact preview labels exact same/different/added/missing URLs, never rewrites the transfer or its snapshot', () => {
  const href = 'https://itunes.apple.com/ua/movie/id123?at=&at=Exact%2fValue#Anchor';
  for (const [current, chosen, label] of [
    [href, href, 'Посилання вже додано'],
    [href.replace('%2f', '%2F'), href, 'Посилання буде замінено.'],
    ['', href, 'Посилання буде додано.'],
    [href, null, 'Посилання буде очищено лише після підтвердження.'],
    ['', null, 'Придатного посилання немає.'],
  ]) {
    assert.equal(linkPreview(current, chosen), label);
    const form = { recommended_medium: 'DVD', purchase_url: current };
    const preview = makePreview(authoredRow(chosen), form, { clearMissing: true });
    assert.equal(preview.before.purchase_url, current);
    assert.equal(preview.after.purchase_url, chosen ?? '');
    assert.equal(preview.rowId, authoredRow().id);
  }
  const empty = { recommended_medium: 'DVD', purchase_url: '' };
  assert.deepEqual(makePreview(authoredRow(null), empty).after, { recommended_medium: 'Apple TV / iTunes', purchase_url: '' });
});
test('unresolved, conflicting provider, unknown platform and unsafe href cannot transfer', () => {
  assert.equal(transferFor({ ...authoredRow(), identityStatus: 'unresolved' }), null);
  assert.equal(transferFor({ ...authoredRow(), providerConflict: true }), null);
  assert.equal(transferFor({ ...authoredRow(), provider: { key: 'plex' } }), null);
  assert.equal(transferFor({ ...authoredRow(), provider: { key: '__proto__' } }), null);
  for (const href of ['javascript:alert(1)', 'http://itunes.apple.com/ua/movie/id123', 'https://x@tv.apple.com/ua/movie/x/umc.cmc.a', 'https://tv.apple.com:444/ua/movie/x/umc.cmc.a', '/relative', 'https://netflix.com/search?q=x', 'https://click.justwatch.com.evil.example/a']) {
    assert.equal(transferFor(authoredRow(href)).url, null);
    assert.equal(transferFor(authoredRow(href)).link.transferable, false);
    const form = { recommended_medium: 'DVD', purchase_url: 'https://manual.example/' };
    assert.equal(makePreview(authoredRow(href), form), null, 'unsafe/missing URL cannot silently erase an existing link');
    assert.equal(makePreview(authoredRow(href), form, { clearMissing: true }).after.purchase_url, '');
  }
});
