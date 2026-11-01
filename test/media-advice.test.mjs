import test from 'node:test';
import assert from 'node:assert/strict';
import { makePreview, applyPreview, transferFor, linkPreview, linkChoicesFor, normalizeMediaCapabilities } from '../assets/media-advice.mjs';
import { presentMediaGroups } from '../assets/media-advice-presentation.mjs';
import { authoredGroupedMediaRows } from './media-advice-group.fixture.mjs';
export const authoredRow = (href = 'https://tv.apple.com/ua/movie/authored/umc.cmc.authored') => ({
  id: 'motn:authored', identityStatus: 'matched', provider: { key: 'apple', name: 'Apple TV Store' },
  country: 'UA', access: { state: 'reported', value: 'rental' }, provenance: { source: 'AUTHORED MOTN' }, link: { href },
});

test('Beta capability is exact and diagnostics require their own explicit authorized capability', () => {
  for (const value of [false, null, undefined, {}, { mykola_media_advice: false, mykola_media_advice_diagnostics: true }, { mykola_media_advice: 'true' }]) {
    assert.deepEqual(normalizeMediaCapabilities(value), { mykola_media_advice: false, mykola_media_advice_diagnostics: false });
  }
  for (const value of [true, { mykola_media_advice: true }, { mykola_media_advice: true, mykola_media_advice_diagnostics: 'true' }]) {
    assert.deepEqual(normalizeMediaCapabilities(value), { mykola_media_advice: true, mykola_media_advice_diagnostics: false });
  }
  assert.deepEqual(normalizeMediaCapabilities({ mykola_media_advice: true, mykola_media_advice_diagnostics: true }), { mykola_media_advice: true, mykola_media_advice_diagnostics: true });
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

test('four authored Supergirl-shaped Rakuten rows offer only distinct literal admitted links, leaving all observations intact', () => {
  const rows = authoredGroupedMediaRows(), before = JSON.stringify(rows);
  const info = presentMediaGroups(rows).find(info => info.group.key === 'rakuten');
  const links = linkChoicesFor(info);
  assert.equal(info.group.rows.length, 4); assert.equal(links.length, 3);
  assert.strictEqual(links[0].row, info.transferRow);
  assert.deepEqual(links.map(link => link.href), [...new Set(info.group.rows.map(row => row.link.href))]);
  for (const link of links) assert.ok(info.group.rows.includes(link.row));
  assert.equal(JSON.stringify(rows), before);
  const form = { recommended_medium: 'DVD', purchase_url: '' };
  for (const link of links) {
    const preview = makePreview(link.row, form);
    assert.equal(preview.rowId, link.row.id); assert.equal(preview.after.purchase_url, link.href);
  }

  const one = info.group.rows.map(row => ({ ...row, link: { href: links[0].href } }));
  const single = presentMediaGroups(one)[0];
  assert.equal(linkChoicesFor(single).length, 1);
  assert.equal(single.group.rows.length, 4, 'deduplication never removes source observations');
});

test('single Apple fallback preserves the preferred original URL without normalizing queries, encoding or fragments', () => {
  const href = 'https://click.justwatch.com/a?token=Authored%2fOnly#Anchor';
  const first = authoredRow(href), preferred = { ...authoredRow(href), id: 'preferred-original', access: { state: 'reported', value: 'purchase' } };
  const changed = { ...authoredRow(href.replace('%2f', '%2F')), id: 'different-literal' };
  const fragment = { ...authoredRow(href.replace('#Anchor', '#Other')), id: 'different-fragment' };
  const group = { key: 'apple', rows: [first, preferred, changed, fragment], readOnly: false };
  const before = JSON.stringify(group), links = linkChoicesFor({ group, transferRow: preferred });
  assert.deepEqual(links.map(link => link.href), [href]);
  assert.strictEqual(links[0].row, preferred); assert.equal(JSON.stringify(group), before);
  assert.equal(makePreview(links[0].row, { recommended_medium: 'DVD', purchase_url: '' }).rowId, preferred.id);
});

test('zero/one/multiple link choices exclude missing, unsafe and refused URLs without hiding safe conflicting observations', () => {
  const unsafe = authoredRow('javascript:alert(1)'), missing = authoredRow(null), good = authoredRow();
  const info = rows => ({ group: { key: 'apple', rows, readOnly: false }, transferRow: rows[0] });
  const refused = { ...good, identityStatus: 'unresolved' }, providerConflict = { ...good, providerConflict: true };
  assert.deepEqual(linkChoicesFor(info([unsafe, missing, refused, providerConflict])), []);
  assert.equal(linkChoicesFor(info([unsafe, missing, good])).length, 1);
  const fieldConflict = { ...good, id: 'safe-field-conflict', audio: { state: 'conflicting' }, conflicts: [{ field: 'audio' }] };
  assert.strictEqual(linkChoicesFor(info([fieldConflict]))[0].row, fieldConflict);
  assert.deepEqual(linkChoicesFor({ group: { key: 'apple', rows: [good], readOnly: true } }), []);
  assert.deepEqual(linkChoicesFor({ group: { key: 'netflix', rows: [good] } }), []);
});
