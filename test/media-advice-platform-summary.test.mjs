import test from 'node:test';
import assert from 'node:assert/strict';
import { presentMediaGroups, summarizeMediaGroups } from '../assets/media-advice-presentation.mjs';
import { makePreview } from '../assets/media-advice.mjs';
const row = (id, key, extra = {}) => ({ id, provider: { key }, identityStatus: 'matched', country:'UA', conflicts:[], ...extra });
const block = (key='rakuten', extra={}) => row('kinobaza:block',key,{country:null,kinobazaLocalization:{audio:{state:'reported-positive'},subtitles:{state:'reported-positive'}},...extra});
const pointer = (key='rakuten', extra={}) => row('kinobaza:ua',key,{link:{href:'https://rakuten.tv/ua/movies/authored'},...extra});
const sub = () => row('tmdb:hbo','hbo',{access:{state:'reported',value:'subscription'}});
test('Supergirl-shaped observations form one result per service and preserve original source rows', () => {
  const rows = [row('motn:buy','prime',{access:{state:'reported',value:'buy'}, audio:{state:'reported',ukrainian:[{language:'uk'}]},link:{href:'https://www.primevideo.com/detail/AUTHORED'}}),row('motn:rent','prime',{access:{state:'reported',value:'rent'}}),sub(),row('kinobaza:hbo','hbo',{link:{href:'https://click.justwatch.com/a'}}),row('tmdb:rent','rakuten',{access:{state:'reported',value:'rental'}}),row('tmdb:buy','rakuten',{access:{state:'reported',value:'buy'}}),pointer(),block()];
  const before=JSON.stringify(rows), groups=presentMediaGroups(rows);
  assert.equal(groups.length,3); const rak=groups.find(x=>x.group.key==='rakuten');
  assert.equal(rak.access,'Оренда / Купівля'); assert.equal(rak.inferred,true); assert.equal(rak.band,'ua-audio');
  assert.match(rak.audio,/є згадка/); assert.match(rak.subtitles,/є згадка/); assert.equal(rak.transferRow,rows[6]);
  assert.match(rak.warnings.join(' '),/країна.*не підтверджені/); assert.equal(JSON.stringify(rows),before);
  assert.equal(makePreview(rak.transferRow,{recommended_medium:'DVD',purchase_url:''}).after.purchase_url,rows[6].link.href);
  const hbo=groups.find(x=>x.group.key==='hbo'); assert.equal(hbo.access,'Передплата'); assert.equal(hbo.transferRow,rows[3]);
  assert.equal(makePreview(hbo.transferRow,{recommended_medium:'',purchase_url:''}).after.purchase_url,rows[3].link.href,'M4 explicit apply needs no separate tracking checkbox');
  assert.match(summarizeMediaGroups(groups),/Rakuten TV|Prime Video/);
});
test('Rakuten inference needs matched Kinobaza UA link and matched same-provider localization', () => {
  for (const rows of [[pointer('rakuten',{country:null}),block()],[pointer('rakuten',{link:{href:null}}),block()],[pointer('rakuten',{id:'tmdb:ua'}),block()],[pointer(),block('apple')],[pointer(),block('rakuten',{identityStatus:'unresolved'})],[pointer(),block('rakuten',{country:'PL'})],[pointer(),block('rakuten',{providerConflict:true})]]) {
    const rak=presentMediaGroups(rows).find(x=>x.group.key==='rakuten'); assert.equal(rak.inferred,false);
  }
});
test('negative or conflicting block evidence is not converted to positive', () => {
  const rows=[pointer(),block(),block('rakuten',{kinobazaLocalization:{audio:{state:'reported-negative'},subtitles:{state:'conflicting'}}})];
  const g=presentMediaGroups(rows)[0]; assert.equal(g.inferred,false); assert.notEqual(g.band,'ua-audio');
});
test('other platforms keep localization in its original scope',()=>{
  const a=pointer('apple',{link:{href:'https://itunes.apple.com/ua/movie/id123'}}),b=block('apple');
  const g=presentMediaGroups([a,b])[0]; assert.equal(g.inferred,false); assert.match(g.audio,/невідомо/);
});
test('only positive language fields are promoted and normal UA audio can still rank first',()=>{
  const subtitleBlock=block('rakuten',{kinobazaLocalization:{audio:{state:'unknown'},subtitles:{state:'reported-positive'}}});
  const g=presentMediaGroups([pointer(),subtitleBlock])[0]; assert.equal(g.band,'ua-subtitles');assert.match(g.audio,/невідомо/);assert.match(g.subtitles,/згадка/);
  const direct=row('motn:direct','rakuten',{audio:{state:'reported',ukrainian:[{language:'uk'}]}});
  const strongest=presentMediaGroups([pointer(),subtitleBlock,direct])[0];assert.equal(strongest.band,'ua-audio');assert.doesNotMatch(summarizeMediaGroups([strongest]),/Кінобаза.*аудіо/);
});
test('conflicted localization cannot be combined even with a second positive block',()=>{
  const conflicting=block('rakuten',{conflicts:[{field:'audio'}]});
  const g=presentMediaGroups([pointer(),block(),conflicting])[0];assert.equal(g.inferred,false);
});
