// Authored HTML/API data only, not current or historical source evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createKinobazaResolver } from '../netlify/lib/kinobaza-resolver.mjs';
import { markup } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';
import { safeSearchCorrelation, safePossibleIrrelevantSearch, safeSearchCardURL } from '../shared/media-search-relevance-diagnostic.mjs';

const KEY = 'AUTHORED_PRIVATE_SEARCH_KEY', OTHER = 'AUTHORED_PRIVATE_OTHER_KEY';
const SEARCH = 'https://api.tavily.com/search';
const URLS = ['first-authored-card','second-authored-card'].map(s=>'https://kinobazaua.com/titles/'+s);
const FILM = { id:'imdb:tt999900001',imdbId:'tt999900001',tmdbId:999900001,
  identityTitle:'Вигаданий фільм',originalTitle:'Authored original',year:2001,
  titleAliases:['Відома інша назва','Known alternate title'],directorAliases:['Authored director'],directorCount:1 };
const wrong = url => markup({url,title:'Інший авторський фільм',original:'Another authored original'});
async function resolve({html=wrong,diagnostics=true,denySecond=false,searchError=false,missingCorrelation=false}={}) {
  const sent=[],reserved=[],calls=[];let searches=0;
  const result=await createKinobazaResolver({apiKey:KEY})(FILM,{calls,sourceCap:8,diagnostics,diagnosticSecrets:[OTHER],
    reserve:async stage=>{if(denySecond&&stage==='kinobaza-2')throw Error('denied');assert.ok(!reserved.includes(stage));reserved.push(stage);},
    fetchImpl:async(url,init)=>{
      sent.push(url);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');
      if(url===SEARCH){searches++;if(searchError&&searches===2)return new Response('PRIVATE_ERROR',{status:503});
        return Response.json({...missingCorrelation?{}:{query:'Authored original 2001',request_id:'12345678-1234-4234-8234-123456789abc'},
          results:URLS.map(url=>({url,title:'PRIVATE_SEARCH_TITLE',content:'PRIVATE_SNIPPET',score:1}))});}
      assert.ok(URLS.includes(url));return new Response(html(url),{headers:{'content-type':'text/html'}});
    }});
  assert.ok(searches<=2);assert.ok(result.resolver.cardCalls<=2);assert.ok(sent.length<=4);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_SNIPPET|PRIVATE_SEARCH_TITLE|PRIVATE_ERROR|AUTHORED_PRIVATE/);
  return {result,sent,reserved,calls};
}
test('both unrelated title fields produce only a possible diagnostic with actual POST correlation and read cards',async()=>{
  const {result,sent}=await resolve();const d=result.resolver.possibleIrrelevantSearch;
  assert.equal(d.film.imdbId,FILM.imdbId);assert.equal(d.film.year,2001);
  assert.equal(d.searches.length,2);assert.match(d.searches[0].query,/Authored original/);
  assert.equal(d.searches[0].responseQuery,'Authored original 2001');
  assert.equal(d.searches[0].requestId,'12345678-1234-4234-8234-123456789abc');
  assert.deepEqual(d.cards.map(c=>c.url),URLS);assert.ok(d.cards.every(c=>c.titleMismatch&&c.reason==='source-title-conflict'));
  assert.equal(result.result,null);assert.equal(sent.length,4);
});
test('diagnostic observation never changes queries, order, identity, reservations or source budget',async()=>{
  const enabled=await resolve(),disabled=await resolve({diagnostics:false});
  const {possibleIrrelevantSearch,...summary}=enabled.result.resolver;
  assert.ok(possibleIrrelevantSearch);assert.deepEqual(summary,disabled.result.resolver);
  assert.deepEqual(enabled.sent,disabled.sent);assert.deepEqual(enabled.reserved,disabled.reserved);
  assert.equal(Object.hasOwn(disabled.result.resolver,'possibleIrrelevantSearch'),false);
});
test('one confirmed card suppresses the section even if another read card is unrelated',async()=>{
  const {result}=await resolve({html:url=>url===URLS[0]?markup({url}):wrong(url)});
  assert.equal(result.result.identity.status,'matched');assert.equal(result.resolver.possibleIrrelevantSearch,undefined);
});
for(const [name,change] of [
  ['known alternative heading',{title:'Відома інша назва',director:'Unverified person'}],
  ['known alternative original',{original:'Known alternate title',director:'Unverified person'}],
  ['unknown heading with known original',{title:'Unestablished translation'}],
  ['director-only refusal',{director:'Unverified person'}],
  ['year-only refusal',{year:2002}],
  ['stable-ID conflict',{stable:'<tr><td>IMDb:</td><td>tt999900002</td></tr>'}],
])test(`${name} is insufficient to label a possible unrelated search`,async()=>{
  const {result}=await resolve({html:url=>markup({url,...change})});
  assert.equal(result.resolver.possibleIrrelevantSearch,undefined);
});
for(const [name,transform] of [
  ['duplicate heading',html=>html.replace('<h1>','<h1>Another heading</h1><h1>')],
  ['multiple originals',html=>html.replace('</h2>','</h2><h2>Another original</h2>')],
  ['missing original',html=>html.replace(/<h2>Another authored original<\/h2>/,'')],
  ['unparseable heading year',html=>html.replace(' (2001)',' (unknown)')],
])test(`${name} remains unknown rather than a title-mismatch warning`,async()=>{
  const {result}=await resolve({html:url=>transform(wrong(url))});
  assert.equal(result.resolver.possibleIrrelevantSearch,undefined);
});
test('only actually dispatched card addresses are reported after a denied later reservation',async()=>{
  const {result,sent}=await resolve({denySecond:true});
  assert.equal(result.resolver.cardCalls,1);
  assert.deepEqual(result.resolver.possibleIrrelevantSearch.cards.map(c=>c.url),[URLS[0]]);
  assert.ok(!sent.includes(URLS[1]));
});

test('a partially parsed second card retains its independently known heading without claiming a title mismatch',async()=>{
  const {result}=await resolve({html:url=>url===URLS[0]?wrong(url):wrong(url).replace(/<h2>Another authored original<\/h2>/,'')});
  const d=result.resolver.possibleIrrelevantSearch;
  assert.equal(d.cards[0].titleMismatch,true);
  assert.equal(d.cards[1].title,'Інший авторський фільм (2001)');
  assert.equal(d.cards[1].originalTitle,null);
  assert.equal(d.cards[1].titleMismatch,null);
  assert.equal(d.cards[1].reason,'source-identity-structure-incomplete');
});
test('provider error and absent correlation fields preserve unknown without inferring values',async()=>{
  const {result}=await resolve({searchError:true,missingCorrelation:true});
  const searches=result.resolver.possibleIrrelevantSearch.searches;
  assert.ok(searches.every(s=>typeof s.query==='string'&&s.requestId===null&&s.responseQuery===null));
  assert.equal(result.resolver.status,'search-http-error');assert.equal(result.resolver.cardCalls,1);
});
test('no confirmed card is checked again when sanitizing an injected diagnostic',()=>{
  assert.equal(safePossibleIrrelevantSearch({cards:[{identity:'matched',titleMismatch:true}]}),null);
});
test('actual keys, encoded echoes, URI-shaped fields, controls and long content are withheld',()=>{
  for(const text of [KEY,encodeURIComponent(OTHER),`token=${OTHER}`,'Bearer arbitrary-private-value','https://source.example/raw','<html>raw</html>', 'x\nraw', 'X'.repeat(601)]){
    assert.deepEqual(safeSearchCorrelation({query:text,requestId:text,responseQuery:text},{secrets:[KEY,OTHER]}),{query:null,requestId:null,responseQuery:null});
  }
  assert.equal(safeSearchCardURL(URLS[0]+'?token=private'),null);
  assert.equal(safeSearchCardURL('https://foreign.example/titles/authored'),null);
  assert.equal(safeSearchCardURL('https://kinobazaua.com/titles/'+KEY.toLowerCase().replaceAll('_','-'),{secrets:[KEY.toLowerCase().replaceAll('_','-')]}),null);
});
