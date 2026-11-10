import test from 'node:test';
import assert from 'node:assert/strict';
import { groupLinkChoices } from '../assets/media-advice-link-choices.mjs';
import { applyPreview, linkChoicesFor, makePreview } from '../assets/media-advice.mjs';

// Authored navigation evidence, not archived responses or redirect observations.
const card = Object.freeze({
  appletvplus: 'https://tv.apple.com/ua/movie/authored/umc.cmc.authored',
  apple: 'https://tv.apple.com/ua/movie/authored/umc.cmc.authored',
  rakuten: 'https://www.rakuten.tv/ua/movies/authored',
  netflix: 'https://www.netflix.com/title/12345678',
  prime: 'https://www.primevideo.com/detail/0AUTHORED',
  megogo: 'https://megogo.net/ua/view/123456-authored.html',
});
const row = (provider, id, href = card[provider], extra = {}) => ({
  id, filmId: 'imdb:tt1234567', identityStatus: 'matched', country: null,
  provider: { key: provider, sourceName: provider }, link: { href }, ...extra,
});
const wrapper = (target, cx = 'AUTHORED', country = 'ua') =>
  `https://click.justwatch.com/a?cx=${cx}&r=${encodeURIComponent(target)}&uct_country=${country}`;
const choices = (providerKey, rows, preferredRow) => groupLinkChoices(rows, { providerKey, preferredRow });

test('every supported provider collapses literal-equal URLs without mutating source observations', () => {
  for (const provider of [...Object.keys(card), 'hbo']) {
    const href = card[provider] ?? wrapper('https://www.hbomax.com/authored');
    const first = row(provider, `${provider}:first`, href, { access: { state: 'reported', value: 'rent' } });
    const preferred = row(provider, `${provider}:preferred`, href, { access: { state: 'reported', value: 'purchase' } });
    const rows = [first, preferred], before = JSON.stringify(rows), grouped = choices(provider, rows, preferred);
    assert.equal(grouped.length, 1, provider);
    assert.deepEqual(grouped[0].members, rows); assert.strictEqual(grouped[0].row, preferred);
    assert.equal(grouped[0].href, href); assert.equal(JSON.stringify(rows), before);
  }
});

test('Plus wrappers with the same admitted Apple card collapse without borrowing tracks', () => {
  const unknown = row('appletvplus', 'motn', wrapper(card.appletvplus, 'ONE'), {
    access: { state: 'reported', value: 'subscription' }, audio: { state: 'unknown' }, subtitles: { state: 'unknown' },
    provenance: { source: 'Movie of the Night' },
  });
  const caption = row('appletvplus', 'kino', wrapper(card.appletvplus, 'TWO'), {
    access: { state: 'reported', value: 'subscription' }, audio: { state: 'unknown' },
    subtitles: { state: 'reported-positive', language: 'uk' }, provenance: { source: 'Kinobaza HTML' },
  });
  const rows = [unknown, caption], before = JSON.stringify(rows), grouped = choices('appletvplus', rows, caption);
  assert.equal(grouped.length, 1); assert.equal(grouped[0].equivalence, 'same-admitted-card-pointer');
  assert.strictEqual(grouped[0].row, caption); assert.deepEqual(grouped[0].members, rows);
  assert.equal(unknown.subtitles.state, 'unknown'); assert.equal(JSON.stringify(rows), before);
});

test('all reviewed native providers compare strict UA wrappers declaring the exact same target', () => {
  for (const provider of Object.keys(card)) {
    const rows = [row(provider, 'one', wrapper(card[provider], 'ONE')), row(provider, 'two', wrapper(card[provider], 'TWO'))];
    const grouped = choices(provider, rows, rows[1]);
    assert.equal(grouped.length, 1, provider); assert.strictEqual(grouped[0].row, rows[1]);
    assert.equal(grouped[0].href, rows[1].link.href); assert.deepEqual(grouped[0].members, rows);
  }
});

test('an exact native card and UA declared target share navigation when market evidence is compatible', () => {
  for (const provider of Object.keys(card)) {
    const native = row(provider, 'native', card[provider], { country: 'UA' });
    const wrapped = row(provider, 'wrapped', wrapper(card[provider]));
    const grouped = choices(provider, [native, wrapped], wrapped);
    assert.equal(grouped.length, 1, provider); assert.strictEqual(grouped[0].row, wrapped);
    assert.equal(grouped[0].href, wrapped.link.href, 'never replace the selected original wrapper with its parameter');
  }
});

test('Netflix and Prime regionless native pointers need compatible row market evidence to join a UA wrapper', () => {
  for (const provider of ['netflix', 'prime']) {
    const wrapped = row(provider, 'wrapped', wrapper(card[provider]));
    assert.equal(choices(provider, [row(provider, 'unknown'), wrapped]).length, 2, provider);
    assert.equal(choices(provider, [row(provider, 'foreign', card[provider], { country: 'US' }), wrapped]).length, 2, provider);
    assert.equal(choices(provider, [row(provider, 'ua', card[provider], { country: 'UA' }), wrapped]).length, 1, provider);
  }
});

test('locale-looking Netflix and Prime path segments do not establish Ukrainian market context', () => {
  for (const [provider, href] of [['netflix', 'https://www.netflix.com/ua/title/12345678'],
    ['prime', 'https://www.primevideo.com/ua/detail/0AUTHORED']]) {
    assert.equal(choices(provider, [row(provider, 'native', href), row(provider, 'wrapped', wrapper(href))]).length, 2, provider);
    assert.equal(choices(provider, [row(provider, 'native', href, { country: 'UA' }), row(provider, 'wrapped', wrapper(href))]).length, 1, provider);
  }
});

test('new provider comparison preserves host, path, locale, slug and identifier differences', () => {
  const variants = {
    netflix: ['https://netflix.com/title/12345678', 'https://www.netflix.com/ua/title/12345678',
      'https://www.netflix.com/title/12345678/', 'https://www.netflix.com/title/87654321'],
    prime: ['https://primevideo.com/detail/0AUTHORED', 'https://www.primevideo.com/ua/detail/0AUTHORED',
      'https://www.primevideo.com/detail/0AUTHORED/', 'https://www.primevideo.com/detail/0OTHER'],
    megogo: ['https://www.megogo.net/ua/view/123456-authored.html', 'https://megogo.net/ua/view/123456-another.html',
      'https://megogo.net/ua/view/123456', 'https://megogo.net/ua/view/654321-authored.html'],
  };
  for (const [provider, hrefs] of Object.entries(variants)) for (const href of hrefs) {
    assert.equal(choices(provider, [row(provider, 'one', wrapper(card[provider])), row(provider, 'two', wrapper(href))]).length, 2, `${provider}: ${href}`);
  }
});

test('non-Apple query spelling and ordering stay literal, even for similarly named tracking fields', () => {
  for (const provider of ['netflix', 'prime', 'megogo', 'rakuten']) {
    const first = row(provider, 'first', wrapper(`${card[provider]}?at=ONE&opaque=AUTHORED%2fVALUE`));
    const same = row(provider, 'same', wrapper(`${card[provider]}?at=ONE&opaque=AUTHORED%2fVALUE`, 'SECOND'));
    assert.equal(choices(provider, [first, same]).length, 1, provider);
    for (const suffix of ['?at=TWO&opaque=AUTHORED%2fVALUE', '?opaque=AUTHORED%2fVALUE&at=ONE',
      '?at=ONE&opaque=AUTHORED%2FVALUE', '?at=ONE&opaque=OTHER', '']) {
      assert.equal(choices(provider, [first, row(provider, 'other', wrapper(`${card[provider]}${suffix}`))]).length, 2, `${provider}: ${suffix}`);
    }
  }
});

test('Plus uses only the existing documented Apple tracking exclusions', () => {
  const first = row('appletvplus', 'one', `${card.appletvplus}?at=ONE&ct=FIRST&itscg=GROUP&itsct=PARTNER&l=uk`);
  const other = row('appletvplus', 'two', `${card.appletvplus}?l=uk&itsct=OTHER&ct=SECOND&at=TWO&itscg=OTHER`);
  const grouped = choices('appletvplus', [first, other], other);
  assert.equal(grouped.length, 1); assert.strictEqual(grouped[0].row, other); assert.equal(grouped[0].href, other.link.href);
  assert.equal(choices('appletvplus', [first, row('appletvplus', 'other-language', `${card.appletvplus}?l=en`)]).length, 2);
});

test('Plus preserves playableId value and presence as a content qualifier', () => {
  const one = row('appletvplus', 'one', `${card.appletvplus}?playableId=tvs.sbd.9001%3A123&at=ONE`);
  const same = row('appletvplus', 'same', wrapper(`${card.appletvplus}?playableId=tvs.sbd.9001:123&ct=TWO`));
  assert.equal(choices('appletvplus', [one, same]).length, 1);
  for (const suffix of ['', '?playableId=tvs.sbd.9001:456', '?playableId=tvs.sbd.9001%253A123', '?playableId=tvs.sbd.9001:123&playableId=tvs.sbd.9001:123']) {
    assert.equal(choices('appletvplus', [one, row('appletvplus', 'different', `${card.appletvplus}${suffix}`)]).length, 2, suffix);
  }
});

test('Plus does not equate different Apple cards, markets or iTunes Store routes', () => {
  const rows = [row('appletvplus', 'one'), row('appletvplus', 'other', card.appletvplus.replace('umc.cmc.authored', 'umc.cmc.other')),
    row('appletvplus', 'market', card.appletvplus.replace('/ua/', '/gb/'))];
  assert.equal(choices('appletvplus', rows).length, 3);
  assert.equal(choices('appletvplus', [row('appletvplus', 'store', 'https://itunes.apple.com/ua/movie/id123456')]).length, 0);
});

test('raw Unicode and UTF-8-encoded Apple movie slugs compare by the admitted card ID', () => {
  const slug = 'написана-назва', raw = card.appletvplus.replace('/authored/', `/${slug}/`),
    encoded = card.appletvplus.replace('/authored/', `/${encodeURIComponent(slug)}/`);
  for (const provider of ['apple', 'appletvplus']) {
    const original = row(provider, 'raw', `${raw}?at=ONE`), preferred = row(provider, 'encoded', `${encoded}?at=TWO`);
    const before = JSON.stringify([original, preferred]), grouped = choices(provider, [original, preferred], preferred);
    assert.equal(grouped.length, 1, provider); assert.strictEqual(grouped[0].row, preferred);
    assert.equal(grouped[0].href, preferred.link.href); assert.equal(JSON.stringify([original, preferred]), before);
  }
});

test('the Unicode slug allowance does not normalize encoded structure, ASCII, malformed or nested escapes', () => {
  for (const provider of ['apple', 'appletvplus']) for (const slug of ['authored%2Fother', '%61uthored', 'authored%20name',
    'authored%252Fother', 'authored%2Ename', '%D0', '%ZZ', 'authored%5Cother']) {
    const href = card[provider].replace('/authored/', `/${slug}/`);
    assert.equal(choices(provider, [row(provider, 'normal', card[provider]), row(provider, 'ambiguous', href)]).length, 2, `${provider}: ${slug}`);
  }
});

test('the Unicode allowance is limited to Apple movie slug, not host, IDs, other providers or path normalization', () => {
  const encodedID = card.appletvplus.replace('umc.cmc.authored', 'umc.cmc.%61uthored');
  assert.deepEqual(choices('appletvplus', [row('appletvplus', 'rejected-id', encodedID)]), [], 'shared link policy still rejects encoded card IDs');
  for (const href of ['https://tv.apple.com:443/ua/movie/authored/umc.cmc.authored',
    'https://tv.apple.com/ua/movie/x/../authored/umc.cmc.authored']) {
    assert.equal(choices('appletvplus', [row('appletvplus', 'normal'), row('appletvplus', 'ambiguous', href)]).length, 2, href);
  }
  const raw = 'https://megogo.net/ua/view/123456-написана.html', encoded = 'https://megogo.net/ua/view/123456-%D0%BD%D0%B0%D0%BF%D0%B8%D1%81%D0%B0%D0%BD%D0%B0.html';
  assert.equal(choices('megogo', [row('megogo', 'raw', raw), row('megogo', 'encoded', encoded)]).length, 2);
});

test('unknown or ambiguous wrapper semantics remain separate for every new provider route', () => {
  for (const provider of ['appletvplus', 'netflix', 'prime', 'megogo']) {
    const target = card[provider], valid = wrapper(target), variants = [
      `${valid}&extra=ONE`, `${valid}&r=${encodeURIComponent(target)}`, valid.replace('cx=AUTHORED', '%63x=AUTHORED'),
      valid.replace('&uct_country=ua', ''), wrapper(target, 'OTHER', 'gb'), wrapper(wrapper(target)),
      `${valid}#section`, wrapper(`${target}?`), wrapper(`${target}#section`),
    ];
    for (const href of variants) assert.equal(choices(provider, [row(provider, 'valid', valid), row(provider, 'opaque', href)]).length, 2, `${provider}: ${href}`);
  }
});

test('a wrong-provider declared target cannot establish equivalent navigation', () => {
  for (const provider of ['appletvplus', 'netflix', 'prime', 'megogo']) {
    const wrongTarget = provider === 'netflix' ? card.prime : card.netflix;
    const rows = [row(provider, 'one', wrapper(wrongTarget, 'ONE')), row(provider, 'two', wrapper(wrongTarget, 'TWO'))];
    assert.equal(choices(provider, rows).length, 2, provider);
  }
});

test('HBO remains literal-only when its declared native route is not admitted by shared policy', () => {
  const target = 'https://www.hbomax.com/authored';
  assert.equal(choices('hbo', [row('hbo', 'one', wrapper(target, 'ONE')), row('hbo', 'two', wrapper(target, 'TWO'))]).length, 2);
  assert.equal(choices('hbo', [row('hbo', 'native', target)]).length, 0);
});

test('country conflicts and explicit edition differences cannot bridge Plus semantic groups', () => {
  const first = row('appletvplus', 'ua', `${card.appletvplus}?at=ONE`, { country: 'UA' });
  assert.equal(choices('appletvplus', [first, row('appletvplus', 'foreign', `${card.appletvplus}?at=TWO`, { country: 'US' })]).length, 2);
  for (const field of ['cut', 'package', 'version']) {
    const specified = row('appletvplus', 'specified', `${card.appletvplus}?at=ONE`, { [field]: { state: 'reported', value: 'authored-edition' } });
    assert.equal(choices('appletvplus', [specified, row('appletvplus', 'unknown', `${card.appletvplus}?at=TWO`)]).length, 2, field);
    assert.equal(choices('appletvplus', [specified, row('appletvplus', 'conflict', `${card.appletvplus}?at=TWO`, { conflicts: [{ field }] })]).length, 2, field);
  }
});

test('grouped choices retain exact original preview and explicit apply addresses for all reviewed providers', () => {
  const beforeForm = { recommended_medium: 'DVD', purchase_url: 'https://example.com/authored-old' };
  for (const provider of Object.keys(card)) {
    const first = row(provider, 'one', wrapper(card[provider], 'ONE')), selected = row(provider, 'selected', wrapper(card[provider], 'SECOND'));
    const grouped = choices(provider, [first, selected], selected), preview = makePreview(grouped[0].row, beforeForm);
    assert.equal(grouped.length, 1, provider); assert.equal(preview.rowId, selected.id);
    assert.equal(preview.after.purchase_url, selected.link.href); assert.equal(applyPreview(preview, beforeForm).purchase_url, selected.link.href);
    assert.equal(beforeForm.purchase_url, 'https://example.com/authored-old');
  }
});

test('one Apple service retains Store UI preference and separate subscription product even for equal hrefs', () => {
  const store = row('apple', 'store'), plus = row('appletvplus', 'plus');
  const rows = [store, plus], before = JSON.stringify(rows), grouped = linkChoicesFor({ group: { key: 'apple', rows }, transferRow: plus });
  assert.equal(grouped.length, 2); assert.deepEqual(grouped.map(choice => choice.row.provider.key), ['apple', 'appletvplus']);
  assert.equal(grouped[0].equivalence, 'ui-preference-not-equivalence');
  assert.equal(JSON.stringify(rows), before);
});

test('new grouping never admits unresolved identity, provider conflicts or unsafe URLs', () => {
  for (const provider of Object.keys(card)) {
    const good = row(provider, 'good', wrapper(card[provider]));
    const rows = [good, { ...good, id: 'unresolved', identityStatus: 'unresolved' }, { ...good, id: 'conflict', providerConflict: true },
      row(provider, 'unsafe', 'javascript:alert(1)')];
    assert.deepEqual(choices(provider, rows).map(choice => choice.row), [good], provider);
  }
});
