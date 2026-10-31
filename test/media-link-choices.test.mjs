import test from 'node:test';
import assert from 'node:assert/strict';
import { groupLinkChoices } from '../assets/media-advice-link-choices.mjs';
import { makePreview } from '../assets/media-advice.mjs';

// Authored pointers only: these do not reconstruct a live source response.
const apple = 'https://tv.apple.com/ua/movie/authored/umc.cmc.authored';
const rakuten = 'https://www.rakuten.tv/ua/movies/authored';
const row = (id, href, providerKey = 'apple', extra = {}) => ({
  id, identityStatus: 'matched', country: null, provider: { key: providerKey }, link: { href }, ...extra,
});
const wrapper = (target, cx = 'AUTHORED', country = 'ua') =>
  `https://click.justwatch.com/a?cx=${cx}&r=${encodeURIComponent(target)}&uct_country=${country}`;
const choices = (rows, providerKey = 'apple', preferredRow) => groupLinkChoices(rows, { providerKey, preferredRow });

test('literal duplicates keep every original observation and the preferred original representative', () => {
  const rows = [row('rent', apple), row('buy', apple, 'apple', { access: { state: 'reported', value: 'purchase' } })];
  const before = JSON.stringify(rows), result = choices(rows, 'apple', rows[1]);
  assert.equal(result.length, 1); assert.strictEqual(result[0].row, rows[1]);
  assert.equal(result[0].href, apple); assert.deepEqual(result[0].members, rows);
  assert.equal(JSON.stringify(rows), before);
});

test('Rakuten wrappers differing only cx share the independently admitted declared regional card, not an inferred offer', () => {
  const rows = [row('ua', wrapper(rakuten, 'one'), 'rakuten', { country: 'UA' }), row('block', wrapper(rakuten, 'two'), 'rakuten')];
  const before = JSON.stringify(rows), result = choices(rows, 'rakuten', rows[1]);
  assert.equal(result.length, 1); assert.equal(result[0].equivalence, 'same-admitted-card-pointer');
  assert.strictEqual(result[0].row, rows[1]); assert.equal(result[0].href, rows[1].link.href);
  assert.deepEqual(result[0].members, rows); assert.equal(JSON.stringify(rows), before);
  assert.equal(makePreview(result[0].row, { recommended_medium: '', purchase_url: '' }).after.purchase_url, rows[1].link.href);
});

test('a declared target can share a direct card choice but the original selected wrapper is never substituted', () => {
  const direct = row('direct', rakuten, 'rakuten'), wrapped = row('wrapped', wrapper(rakuten), 'rakuten');
  const result = choices([direct, wrapped], 'rakuten', wrapped);
  assert.equal(result.length, 1); assert.strictEqual(result[0].row, wrapped);
  assert.equal(result[0].href, wrapped.link.href); assert.notEqual(result[0].href, rakuten);
});

test('Apple documented affiliate, campaign, group and partner tokens do not create another card choice', () => {
  const rows = [row('first', `${apple}?at=AUTHORED%2fONE&ct=RENT&itscg=ONE&itsct=FIRST`),
    row('preferred', `${apple}?itsct=SECOND&ct=BUY&at=AUTHORED%2FTWO&itscg=TWO`)];
  const result = choices(rows, 'apple', rows[1]);
  assert.equal(result.length, 1); assert.strictEqual(result[0].row, rows[1]); assert.equal(result[0].href, rows[1].link.href);
  assert.equal(makePreview(result[0].row, { recommended_medium: '', purchase_url: '' }).after.purchase_url, rows[1].link.href);
  const native = [row('one', 'https://itunes.apple.com/ua/movie/id123?at=ONE'), row('two', 'https://itunes.apple.com/ua/movie/id123?at=TWO')];
  assert.equal(choices(native).length, 1);
});

test('playableId is a retained content qualifier, including its presence versus absence', () => {
  const rows = [row('one', `${apple}?playableId=umc.cmc.first&at=ONE`), row('two', `${apple}?playableId=umc.cmc.first&at=TWO`),
    row('different', `${apple}?playableId=umc.cmc.second`), row('missing', apple)];
  assert.equal(choices(rows).length, 3);
});

test('an encoded Apple playableId matches a direct pointer and a JustWatch declared target without replacing the chosen href', () => {
  const target = `${apple}?playableId=tvs.sbd.9001%3A123456`, wrapped = row('wrapped', wrapper(target));
  const direct = row('direct', `${apple}?itscg=ONE&playableId=tvs.sbd.9001:123456&at=AUTHORED%2fONLY&itsct=PARTNER&ct=CAMPAIGN`);
  const before = JSON.stringify([wrapped, direct]), result = choices([wrapped, direct], 'apple', wrapped);
  assert.equal(result.length, 1); assert.deepEqual(result[0].members, [wrapped, direct]);
  assert.strictEqual(result[0].row, wrapped); assert.equal(result[0].href, wrapped.link.href);
  assert.equal(makePreview(result[0].row, { recommended_medium: '', purchase_url: '' }).after.purchase_url, wrapped.link.href);
  assert.equal(JSON.stringify([wrapped, direct]), before);
  for (const qualifier of ['tvs.sbd.9001%3A999999', 'tvs.sbd.9001%253A123456', 'tvs.sbd.9001%3A123456%20', '%ZZ']) {
    assert.equal(choices([wrapped, row('different', `${apple}?playableId=${qualifier}`)]).length, 2, qualifier);
  }
  assert.equal(choices([wrapped, row('absent', apple)]).length, 2);
  assert.equal(choices([wrapped, row('repeated', `${target}&playableId=tvs.sbd.9001%3A123456`)]).length, 2);
});

test('identical unknown raw qualifiers remain in the key while documented Apple tracking differences disappear', () => {
  const card = 'https://itunes.apple.com/ua/movie/id123';
  const first = row('first', `${card}?at=ONE&l=uk&offer=rent&cut=authored`),
    other = row('other', `${card}?l=uk&ct=CAMPAIGN&offer=rent&cut=authored&at=TWO`);
  const result = choices([first, other], 'apple', other);
  assert.equal(result.length, 1); assert.strictEqual(result[0].row, other); assert.equal(result[0].href, other.link.href);
  for (const qualifier of ['l=en&offer=rent&cut=authored', 'l=uk&offer=buy&cut=authored', 'l=uk&offer=rent&cut=extended',
    'l=uk&cut=authored&offer=rent', 'offer=rent&cut=authored', 'l=uk&offer=rent&cut=authored&extra=one']) {
    assert.equal(choices([first, row('different', `${card}?at=TWO&${qualifier}`)]).length, 2, qualifier);
  }
  const encoded = row('encoded', `${card}?at=ONE&opaque=AUTHORED%2fVALUE`);
  assert.equal(choices([encoded, row('same', `${card}?opaque=AUTHORED%2fVALUE&at=TWO`)]).length, 1);
  assert.equal(choices([encoded, row('changed', `${card}?opaque=AUTHORED%2FVALUE&at=TWO`)]).length, 2);
});

test('unknown query distinctions, fragment, repeated keys and ambiguous URL normalization do not disappear', () => {
  for (const suffix of ['?l=uk', '?other=ONE', '?offer=rent', '#section', '#', '?', '?at=ONE&at=TWO', '?%61t=ONE', '?at=%ZZ']) {
    const a = row('a', apple), b = row('b', `${apple}${suffix}`);
    assert.equal(choices([a, b]).length, 2, suffix);
  }
  for (const href of ['https://tv.apple.com:443/ua/movie/authored/umc.cmc.authored', 'https://tv.apple.com/ua/movie/x/../authored/umc.cmc.authored']) {
    assert.equal(choices([row('one', apple), row('literal', href)]).length, 2);
  }
});

test('wrapper ambiguity, extra keys, region disagreement and nested or wrong-provider targets never establish equivalence', () => {
  const valid = wrapper(rakuten), variants = [
    `${valid}&r=${encodeURIComponent(rakuten)}`, `${valid}&cx=OTHER`, `${valid}&extra=one`, valid.replace('&uct_country=ua', ''),
    wrapper(rakuten, 'AUTHORED', 'gb'), wrapper('https://www.rakuten.tv/gb/movies/authored'), wrapper(apple), wrapper(wrapper(rakuten)),
    wrapper(`${rakuten}?offer=rent`), wrapper(`${rakuten}#section`), `${valid}#`,
    valid.replace('/a?', '/other?'), valid.replace('/a?', '/x/../a?'), valid.replace('click.justwatch.com/', 'click.justwatch.com:443/'),
  ];
  for (const href of variants) assert.equal(choices([row('valid', valid, 'rakuten'), row('other', href, 'rakuten')], 'rakuten').length, 2, href);
});

test('unsafe outer pointers are excluded; unsafe embedded values stay opaque rather than authorizing their target', () => {
  const rows = [row('valid', wrapper(rakuten), 'rakuten'), row('unsafe', 'javascript:alert(1)', 'rakuten'),
    row('embedded', wrapper('https://user:password@www.rakuten.tv/ua/movies/authored'), 'rakuten')];
  const result = choices(rows, 'rakuten');
  assert.equal(result.length, 2); assert.ok(result.every(choice => choice.row.id !== 'unsafe'));
  assert.equal(result[1].href, rows[2].link.href, 'existing safe outer-link policy remains authoritative; no destination is opened automatically');
});

test('different provider card IDs, regions, Apple namespaces and Rakuten paths remain distinct', () => {
  assert.equal(choices([row('one', apple), row('two', apple.replace('umc.cmc.authored', 'umc.cmc.other')),
    row('gb', apple.replace('/ua/', '/gb/')), row('itunes', 'https://itunes.apple.com/ua/movie/id123')]).length, 4);
  assert.equal(choices([row('one', rakuten, 'rakuten'), row('two', `${rakuten}-extended`, 'rakuten'), row('slash', `${rakuten}/`, 'rakuten')], 'rakuten').length, 3);
});

test('a source country conflicting with the explicit URL market cannot semantically join another pointer', () => {
  const first = row('ua', `${apple}?at=ONE`, 'apple', { country: 'UA' }), unknown = row('unknown', `${apple}?at=TWO`), foreign = row('us', `${apple}?at=THREE`, 'apple', { country: 'US' });
  const result = choices([first, unknown, foreign]);
  assert.equal(result.length, 2); assert.deepEqual(result[0].members, [first, unknown]); assert.strictEqual(result[1].row, foreign);
});

test('explicit cut, package or version differences stay separate; access type alone does not split a card link', () => {
  for (const field of ['cut', 'package', 'version']) {
    const first = row('first', `${apple}?at=ONE`, 'apple', { [field]: { state: 'reported', value: 'first' } });
    const other = row('other', `${apple}?at=TWO`, 'apple', { [field]: { state: 'reported', value: 'other' } });
    const unknown = row('unknown', `${apple}?at=THREE`);
    assert.equal(choices([first, other, unknown]).length, 3, field);
    assert.equal(choices([first, { ...other, link: first.link }]).length, 1, 'one literal URL remains one navigation action');
  }
  assert.equal(choices([row('rent', `${apple}?at=ONE`, 'apple', { access: { state: 'reported', value: 'rent' } }),
    row('buy', `${apple}?at=TWO`, 'apple', { access: { state: 'reported', value: 'buy' } })]).length, 1);
});

test('MOTN projected package ID/name fields preserve explicit package differences without treating missing fields as a package', () => {
  const unknown = { id: { state: 'not-reported' }, name: { state: 'not-reported' } };
  assert.equal(choices([row('motn', `${apple}?at=ONE`, 'apple', { package: unknown }), row('block', `${apple}?at=TWO`)]).length, 1);
  const reported = value => ({ state: 'reported', value });
  const first = row('first', `${apple}?at=ONE`, 'apple', { package: { id: reported('authored-first'), name: reported('Authored package') } }),
    other = row('other', `${apple}?at=TWO`, 'apple', { package: { id: reported('authored-other'), name: reported('Authored package') } }),
    same = row('same', `${apple}?at=THREE`, 'apple', { package: { id: reported('authored-first'), name: reported('Authored package') } });
  assert.equal(choices([first, other, same]).length, 2);
  assert.equal(choices([first, row('unknown', `${apple}?at=FOUR`, 'apple', { package: unknown })]).length, 2);
});

test('conflicting literal members do not bridge to a third semantic pointer', () => {
  const shared = `${apple}?at=ONE`, first = row('one', shared, 'apple', { cut: { state: 'reported', value: 'first' } }),
    other = row('two', shared, 'apple', { cut: { state: 'reported', value: 'other' } }),
    third = row('third', `${apple}?at=TWO`, 'apple', { cut: { state: 'reported', value: 'first' } });
  const result = choices([first, other, third]);
  assert.equal(result.length, 2); assert.deepEqual(result[0].members, [first, other]);
});

test('ambiguous or malformed edition evidence falls back to literal navigation choices', () => {
  for (const extra of [{ conflicts: { field: 'cut' } }, { conflicts: [{ field: 'version' }] },
    { cut: { state: 'conflicting' } }, { package: { state: 'reported', value: Number.NaN } }, { version: { state: 'reported', value: {} } }]) {
    assert.equal(choices([row('normal', `${apple}?at=ONE`), row('ambiguous', `${apple}?at=TWO`, 'apple', extra)]).length, 2);
  }
});

test('unresolved identity, provider conflicts, wrong group and unknown platform cannot produce choices', () => {
  const good = row('good', apple), rows = [good, { ...good, identityStatus: 'unresolved' }, { ...good, providerConflict: true }, row('other', rakuten, 'rakuten')];
  assert.deepEqual(choices(rows).map(choice => choice.row), [good]);
  assert.deepEqual(choices(rows, 'unknown'), []); assert.deepEqual(choices(null), []);
});
