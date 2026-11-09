// Author-written HTML/API-shaped contexts only. These fixtures are not current
// or historical Kinobaza responses, person proofs or real offer/track evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'parse5';
import { assistedIdentity, linkedDirectorProfile, fetchAssistedKinobaza } from '../netlify/lib/kinobaza-card.mjs';
import { markup, CARD } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';
import { tableBlock, paragraphBlock } from '../research/grounded-answer-demo/test/kinobaza-localization.fixture.mjs';
import { composeDiscovery } from '../research/grounded-answer-demo/discovery.mjs';
import { presentMediaGroups } from '../assets/media-advice-presentation.mjs';
const PERSON=999909001, personURL='https://kinobazaua.com/persons/authored-jay-roach';
const film={id:'authored-fockers',tmdbId:999909002,imdbId:'tt999909002',identityTitle:'Знайомство з Факерами',originalTitle:'Meet the Fockers',year:2004,
  titleAliases:['Знайомство з Факерами','Meet the Fockers'],directorCount:1,directorAliases:['Jay Roach'],
  directorPeople:[{namespace:'tmdb:person',personId:PERSON,names:['Jay Roach']}]};
const noCrosswalk=()=>({status:'unresolved'});
const all=html=>{const nodes=[],stack=[parse(html,{sourceCodeLocationInfo:true})];while(stack.length){const node=stack.pop();nodes.push(node);stack.push(...node.childNodes??[]);}return nodes;};
const source=changes=>markup({title:'Знайомство з Фокерами',original:'Meet the Fockers',year:2004,director:'Jay Roach',...changes});
const inspect=(html=source(),selected=film)=>assistedIdentity(all(html),selected,CARD,{directorAliasLookup:noCrosswalk});
const directorRow=(name='Different authored director',href)=>`<tr><td>Режисер:</td><td>${href?`<a href="${href}">${name}</a>`:name}</td></tr>`;
const row=(namespace,value)=>`<tr><td>${namespace}:</td><td>${value}</td></tr>`;
function withheld(result){assert.notEqual(result.identity?.status,'matched');assert.deepEqual(result.candidates,[]);assert.equal(result.localization,undefined);}
async function read(html,selected=film,options={}){let calls=0;const result=await fetchAssistedKinobaza(CARD,selected,async(url,init)=>{
  calls++;assert.equal(url,CARD);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');return new Response(html,{headers:{'content-type':'text/html; charset=utf-8'}});
},{directorAliasLookup:noCrosswalk,...options});assert.equal(calls,1);return result;}

test('unknown Cyrillic localization needs exact original/year and single confirmed director, not a blanket а/о substitution',()=>{
  const matched=inspect();assert.equal(matched.status,'matched');assert.equal(matched.reason,'explicit-original-year-director-translation-match');
  assert.equal(matched.diagnostics.strategy,'original-year-director-translation');assert.equal(matched.diagnostics.comparisons.headingAliasMatch,false);
  assert.equal(matched.diagnostics.comparisons.originalAliasMatch,true);assert.equal(matched.diagnostics.comparisons.yearEqual,true);
  assert.equal(matched.diagnostics.comparisons.directorAliasMatch,true);assert.equal(matched.diagnostics.gates['heading-alias'],'not-evaluated');
  const exact=inspect(source({title:'Знайомство з Факерами'}));assert.equal(exact.reason,'explicit-title-year-director-match');
});

for(const [part,title,original,year,director]of[
  ['Meet the Parents','Знайомство з батьками','Meet the Parents',2000,'Jay Roach'],
  ['Little Fockers','Маленькі Факери','Little Fockers',2010,'Paul Weitz'],
])test(`series regression: ${part} is not the selected 2004 film`,async()=>{
  const html=source({title,original,year,director}),rejected=inspect(html);
  assert.equal(rejected.status,'mismatch');assert.equal(rejected.reason,'source-title-conflict');
  assert.equal(rejected.diagnostics.comparisons.originalAliasMatch,false);assert.equal(rejected.diagnostics.comparisons.yearEqual,false);
  withheld(await read(html));
});

test('all three authored series contexts can confirm only their own title/original/year/director combination',()=>{
  for(const selected of[
    film,
    {...film,identityTitle:'Знайомство з батьками',originalTitle:'Meet the Parents',year:2000,titleAliases:['Знайомство з батьками','Meet the Parents']},
    {...film,identityTitle:'Маленькі Факери',originalTitle:'Little Fockers',year:2010,titleAliases:['Маленькі Факери','Little Fockers'],directorAliases:['Paul Weitz'],directorPeople:[{namespace:'tmdb:person',personId:999909003,names:['Paul Weitz']}]},
  ]){
    const own=inspect(source({title:selected.identityTitle,original:selected.originalTitle,year:selected.year,director:selected.directorAliases[0]}),selected);
    assert.equal(own.status,'matched');
  }
});

for(const [name,selected,changes,reason]of[
  ['unproved source spelling',film,{director:'Джей Роуч'},'director-alias-unestablished'],
  ['missing source director',film,{director:''},'source-or-selected-director-missing'],
  ['missing trusted director',{...film,directorAliases:[],directorCount:null,directorPeople:[]},{},'source-or-selected-director-missing'],
  ['multiple trusted people',{...film,directorCount:2,directorAliases:['Jay Roach','Another authored person'],directorPeople:[film.directorPeople[0],{namespace:'tmdb:person',personId:999909004,names:['Another authored person']}]},{},'director-scope-unestablished'],
  ['same title and year, different person',film,{director:'Paul Weitz'},'director-alias-unestablished'],
])test(`unknown translation remains unresolved with ${name}`,async()=>{
  const html=source(changes),result=inspect(html,selected);assert.equal(result.status,'unresolved');assert.equal(result.reason,reason);withheld(await read(html,selected));
});

test('same original title is not enough for another year, even with an agreeing film ID or release evidence',()=>{
  for(const stable of['',row('IMDb',film.imdbId)]){
    const result=inspect(source({year:2005,stable}),{...film,identityContext:{tmdbId:film.tmdbId,releaseEvidence:[{year:2005,date:'2005-01-01',type:1,country:'US'}]}});
    assert.equal(result.status,'mismatch');assert.equal(result.reason,'source-year-conflict-unknown-translation');
  }
  const sameNameDifferentFilm=inspect(source({title:'Інший переклад',original:'The Gift',year:2000}),{...film,originalTitle:'The Gift',identityTitle:'Подарунок',titleAliases:['The Gift','Подарунок'],year:2015});
  assert.equal(sameNameDifferentFilm.status,'mismatch');
});

for(const [name,stable]of[
  ['IMDb conflict',row('IMDb','tt999909099')],['TMDb conflict',row('TMDb','999909099')],
  ['agreeing IMDb with conflicting TMDb',row('IMDb',film.imdbId)+row('TMDb','999909099')],
])test(`unknown-translation route cannot override ${name}`,async()=>{
  const html=source({stable}),result=inspect(html);assert.equal(result.status,'mismatch');assert.equal(result.reason,'source-stable-id-conflict');
  assert.equal(result.diagnostics.failedGate,'stable-id-conflict');withheld(await read(html));
});

test('matching stable film IDs do not bypass director proof on the unknown-translation route',()=>{
  const result=inspect(source({director:'Unknown authored name',stable:row('IMDb',film.imdbId)}));
  assert.equal(result.status,'unresolved');assert.equal(result.reason,'director-alias-unestablished');
  assert.equal(result.diagnostics.comparisons.stableIdMatch,true);
});

for(const [name,selected,heading]of[
  ['different Arabic sequel',{...film,identityTitle:'Розділ 2',originalTitle:'Authored Chapter 2',titleAliases:['Розділ 2','Authored Chapter 2']},'Інший розділ 3'],
  ['missing sequel number',{...film,identityTitle:'Розділ 2',originalTitle:'Authored Chapter 2',titleAliases:['Розділ 2','Authored Chapter 2']},'Інший розділ'],
  ['different Roman part',{...film,identityTitle:'Розділ II',originalTitle:'Authored Chapter II',titleAliases:['Розділ II','Authored Chapter II']},'Інший розділ III'],
  ['same Roman suffix but unrelated base',{...film,identityTitle:'Розділ II',originalTitle:'Authored Chapter II',titleAliases:['Розділ II','Authored Chapter II']},'Інший розділ II'],
  ['new sequel number',film,'Знайомство з Фокерами 2'],
])test(`unknown localized heading retains explicit part conflicts: ${name}`,()=>{
  const result=inspect(source({title:heading,original:selected.originalTitle}),selected);assert.equal(result.status,'mismatch');assert.equal(result.reason,'source-title-conflict');
});

test('non-Cyrillic contradictory heading and mixed-script confusable are not treated as unknown translations',()=>{
  for(const title of['Meet the Parents','Meet the Fockers Two','Знайомство з Fокерами']){
    const result=inspect(source({title}));assert.equal(result.status,'mismatch');assert.equal(result.reason,'source-title-conflict');
  }
});

test('two distinct authored films sharing an original title and year are not merged across different director people',()=>{
  const first={...film,identityTitle:'Подарунок',originalTitle:'The Gift',titleAliases:['Подарунок','The Gift'],year:2015,
    directorAliases:['First authored director'],directorPeople:[{namespace:'tmdb:person',personId:999909101,names:['First authored director']}]};
  const second={...first,tmdbId:999909104,imdbId:'tt999909104',directorAliases:['Second authored director'],directorPeople:[{namespace:'tmdb:person',personId:999909102,names:['Second authored director']}]};
  const html=source({title:'Дарунок',original:'The Gift',year:2015,director:'Second authored director'});
  assert.equal(inspect(html,second).status,'matched');
  const rejected=inspect(html,first);assert.equal(rejected.status,'unresolved');assert.equal(rejected.reason,'director-alias-unestablished');
});

test('an unmatched original H2 cannot become a successful unknown localized translation',async()=>{
  const html=source({original:'Meet the Parents'}),result=inspect(html);
  assert.equal(result.status,'mismatch');assert.equal(result.reason,'source-title-conflict');withheld(await read(html));
});

test('the unknown-translation route requires actual original, not merely another known alias',()=>{
  const selected={...film,titleAliases:[...film.titleAliases,'A known alternate']};
  const result=inspect(source({original:'A known alternate'}),selected);assert.notEqual(result.status,'matched');
});

test('competing or repeated H2 nodes remain unresolved; matching H2 is never cherry-picked',async()=>{
  for(const extra of['Meet the Parents','Meet the Fockers']){
    const html=source().replace('<h2>Meet the Fockers</h2>',`<h2>Meet the Fockers</h2><h2>${extra}</h2>`),result=inspect(html);
    assert.equal(result.status,'unresolved');assert.equal(result.reason,'source-original-title-scope-unestablished');withheld(await read(html));
  }
});

test('director rows before the main title and after availability, including dubbing, are not film directors',()=>{
  const outside=`<table>${directorRow('Outside director')}</table>`;
  const html=source().replace('<h1>',outside+'<h1>').replace('</body>',`<h3>Українське озвучення</h3><table>${directorRow('Authored dubbing director')}</table>${outside}</body>`);
  const result=inspect(html);assert.equal(result.status,'matched');assert.equal(result.diagnostics.counts.directorCount,1);
});

test('two distinct film-metadata director rows or a multi-person value remain ambiguous',async()=>{
  for(const html of[source().replace('<tr><td>Режисер:</td><td>Jay Roach</td></tr>',directorRow('Jay Roach')+directorRow()),
    source({director:'Jay Roach / Another authored person'})]){
    const result=inspect(html);assert.equal(result.status,'unresolved');
    assert.ok(['director-scope-unestablished','director-alias-unestablished'].includes(result.reason));withheld(await read(html));
  }
});

test('inline director labels use the same metadata interval and cannot import a later dubbing-credit alias',()=>{
  const html=source({director:''}).replace('</table>','</table><p><strong>Режисер:</strong><a href="/persons/authored-jay-roach">Jay Roach</a></p>')
    .replace('</body>','<p><strong>Режисер:</strong><a href="/persons/authored-other">Different authored person</a></p></body>');
  const result=inspect(html);assert.equal(result.status,'matched');assert.equal(result.diagnostics.counts.directorCount,1);
});

for(const [name,field]of[
  ['two distinct linked names','<a href="/persons/authored-jay-roach">Jay Roach</a>, <a href="/persons/authored-other">Different authored person</a>'],
  ['a plain-text second name','<a href="/persons/authored-jay-roach">Jay Roach</a>, Different authored person'],
  ['a nested second linked name','<a href="/persons/authored-jay-roach">Jay Roach</a><span> / <a href="/persons/authored-other">Different authored person</a></span>'],
  ['the same name on different linked profiles','<a href="/persons/authored-jay-roach">Jay Roach</a>, <a href="/persons/authored-other-jay-roach">Jay Roach</a>'],
])test(`an inline metadata field cannot silently select its first director: ${name}`,async()=>{
  const html=source({director:''}).replace('</table>',`</table><p><strong>Режисер:</strong>${field}</p>`);
  const result=inspect(html);assert.equal(result.status,'unresolved');
  assert.ok(['director-scope-unestablished','director-alias-unestablished'].includes(result.reason));
  withheld(await read(html));
});

test('two film director fields with the same name and different profile pointers stay ambiguous',async()=>{
  const html=source({director:`<a href="/persons/authored-jay-roach">Jay Roach</a>`,
    stable:directorRow('Jay Roach','/persons/authored-other-jay-roach')});
  const result=inspect(html);assert.equal(result.status,'unresolved');
  assert.equal(result.reason,'director-scope-unestablished');
  assert.equal(linkedDirectorProfile(all(html)),null);withheld(await read(html));
});

test('linked profile selection ignores out-of-metadata rows, but refuses two actual film rows',()=>{
  const linked=source({director:`<a href="${personURL}">Джей Роуч</a>`});
  const outside=`<table>${directorRow('Outside person','/persons/authored-outside')}</table>`;
  const html=linked.replace('<h1>',outside+'<h1>').replace('</body>',outside+'</body>');
  assert.deepEqual(linkedDirectorProfile(all(html)),{sourceURL:personURL,sourceAlias:'Джей Роуч'});
  const ambiguous=linked.replace('<tr><td>Режисер:</td>',directorRow('Other film director','/persons/authored-other')+'<tr><td>Режисер:</td>');
  assert.equal(linkedDirectorProfile(all(ambiguous)),null);
  assert.equal(linkedDirectorProfile(all(source({director:''}).replace('</table>',`</table><p><strong>Режисер:</strong><a href="${personURL}">Джей Роуч</a></p>`))),null);
});

test('unknown localized title reaches the existing linked-person verifier and still needs valid person-scoped proof',async()=>{
  const html=source({director:`<a href="${personURL}">Джей Роуч</a>`});
  for(const confirmed of[false,true]){
    let verification=0;const result=await read(html,film,{verifyDirector:async pointer=>{
      verification++;assert.deepEqual(pointer,{sourceURL:personURL,sourceAlias:'Джей Роуч'});
      return confirmed?{status:'confirmed',aliases:['Джей Роуч'],provenance:{namespace:'tmdb:person',personId:PERSON,scope:'kinobaza-director-identity',sourceURL:personURL,method:'authored-person-proof-not-live'}}:{status:'unresolved',aliases:[]};
    }});
    assert.equal(verification,1);assert.equal(result.identity.status,confirmed?'matched':'unresolved');
    if(confirmed)assert.equal(result.identity.reason,'explicit-original-year-director-translation-match');else withheld(result);
  }
});

test('wrong-person provenance never confirms the unknown localized title',async()=>{
  const html=source({director:`<a href="${personURL}">Джей Роуч</a>`});
  const result=await read(html,film,{verifyDirector:async()=>({status:'confirmed',aliases:['Джей Роуч'],provenance:{namespace:'tmdb:person',personId:PERSON+1,scope:'kinobaza-director-identity',sourceURL:personURL}})});
  withheld(result);assert.equal(result.identity.reason,'director-alias-unestablished');
});

test('HTML to product preserves only matched-film language and safe links on the new route',async()=>{
  const blocks=tableBlock('netflix',[['Укр. субтитри','+']],'https://www.netflix.com/title/999999999')+
    paragraphBlock('megogo','(укр. аудіо [5.1])','https://megogo.net/ua/view/99999999-authored.html');
  const result=await read(source({blocks}));assert.equal(result.identity.status,'matched');
  const projected=composeDiscovery(film,{tmdb:{status:'not-requested',result:null},motn:{status:'not-requested',result:null},kinobaza:{status:result.status,result}});
  const netflix=projected.rows.find(item=>item.provider.key==='netflix'),megogo=projected.rows.find(item=>item.provider.key==='megogo');
  assert.ok(netflix);assert.ok(megogo);assert.equal(netflix.kinobazaLocalization.audio.state,'unknown');assert.equal(netflix.kinobazaLocalization.subtitles.state,'reported-positive');
  assert.equal(megogo.kinobazaLocalization.audio.state,'reported-positive');assert.equal(megogo.kinobazaLocalization.subtitles.state,'unknown');
  assert.equal(netflix.link.href,'https://www.netflix.com/title/999999999');assert.equal(megogo.link.href,'https://megogo.net/ua/view/99999999-authored.html');
  assert.equal(netflix.link.transferable,true);assert.equal(megogo.link.transferable,true);
  const presented=presentMediaGroups(projected.rows,{filmId:film.id}),megogoView=presented.find(group=>group.group.key==='megogo'),netflixView=presented.find(group=>group.group.key==='netflix');
  assert.equal(megogoView.comparison.audio.symbol,'+');assert.equal(megogoView.comparison.subtitles.symbol,'?');
  assert.equal(netflixView.comparison.audio.symbol,'?');assert.equal(netflixView.comparison.subtitles.symbol,'+');
});
