// Authored HTML/API-shaped regressions, not live/historical source responses.
// Familiar film/person names label the case; IDs and offer URLs are fictional.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createKinobazaResolver } from '../netlify/lib/kinobaza-resolver.mjs';
import { markup } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';
import { paragraphBlock } from '../research/grounded-answer-demo/test/kinobaza-localization.fixture.mjs';
import { composeDiscovery } from '../research/grounded-answer-demo/discovery.mjs';
import { productMediaResult } from '../netlify/lib/media-advice-response.mjs';
import { presentMediaGroups } from '../assets/media-advice-presentation.mjs';
import { linkChoicesFor, makePreview, applyPreview } from '../assets/media-advice.mjs';

const CARD = 'https://kinobazaua.com/titles/authored-slevin';
const OTHER = 'https://kinobazaua.com/titles/authored-other';
const PROFILE = 'https://kinobazaua.com/persons/authored-mcguigan';
const HREF = 'https://megogo.net/ua/view/990001-authored.html?exact=%2f&x=1';
const FILM = { id:'imdb:tt9999901', imdbId:'tt9999901', tmdbId:990001,
  identityTitle:'Щасливе число Слевіна', originalTitle:'Lucky Number Slevin', year:2006,
  titleAliases:[], directorCount:1, directorAliases:['Paul McGuigan'],
  directorPeople:[{ namespace:'tmdb:person', personId:990002, names:['Paul McGuigan'] }] };
const PERSON = 'https://api.themoviedb.org/3/person/990002?language=en-US&append_to_response=external_ids';
const baseline = ['tmdb-find','tmdb-details','tmdb-providers','motn-title'];
const profile = ({ birthday='19 вересня 1963', tail='' } = {}) => `<!doctype html><html><head><link rel="canonical" href="${PROFILE}"></head><body><div class="col-8"><h1 class="h2">Пол Макґіґан</h1><h2 class="h3 text-muted">Paul McGuigan</h2><p>Дата народження: ${birthday}</p><p>Ролі: режисер</p></div><details class="js-plot"><summary>Сюжет</summary><em class="nobr"><a href="/titles/authored-note"<br />Authored note</a></em></details>${tail}</body></html>`;
async function run({ sourceCap=12, birthday, tail, stable='', link=HREF } = {}) {
  const calls=baseline.map(stage=>({stage})), reservations=[], requests=[];
  const selected = markup({ url:CARD, title:FILM.identityTitle, original:FILM.originalTitle, year:FILM.year,
    director:`<a href="${PROFILE}">Пол Макґіґан</a>`, stable,
    blocks:paragraphBlock('megogo','(укр. аудіо, укр. субтитри)',link?.replaceAll('&','&amp;')) });
  const resolver=createKinobazaResolver({apiKey:'AUTHORED_SEARCH_KEY'});
  const result=await resolver(FILM,{ sourceCap, tmdbToken:'AUTHORED_TMDB_KEY', diagnostics:true, calls,
    reserve:async stage=>{assert.ok(!reservations.includes(stage));assert.ok(calls.length<sourceCap);reservations.push(stage);},
    fetchImpl:async(url,init)=>{
      requests.push(url); assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');
      if(url==='https://api.tavily.com/search') {
        assert.equal(init.method,'POST');
        return new Response(JSON.stringify({ results:JSON.parse(init.body).exact_match?[]:[{url:CARD},{url:OTHER}] }),{headers:{'content-type':'application/json'}});
      }
      assert.equal(init.method,'GET');
      if(url===PERSON) return new Response(JSON.stringify({id:990002,name:'Paul McGuigan',also_known_as:[],birthday:'1963-09-19',external_ids:{}}),{headers:{'content-type':'application/json'}});
      const html=url===CARD?selected:url===OTHER?markup({url:OTHER,title:'Інший фільм',original:'Other Film',year:2001,director:'Someone Else'}):url===PROFILE?profile({birthday,tail}):assert.fail('unexpected source');
      return new Response(html,{headers:{'content-type':'text/html; charset=utf-8'}});
    } });
  const discovery=composeDiscovery(FILM,{tmdb:{result:null},motn:{result:null},kinobaza:result});
  return {result,discovery,calls,reservations,requests};
}

for(const sourceCap of [10,12]) test(`Slevin-shaped profile recovery reaches languages, protected/ordinary table and exact preview in cap${sourceCap}`,async()=>{
  const {result,discovery,calls,reservations,requests}=await run({sourceCap});
  assert.equal(result.result.identity.status,'matched');
  assert.equal(result.resolver.directorProfile.status,'confirmed');
  assert.equal(result.resolver.directorProfile.basis,'exact-name-birthdate-role');
  assert.equal(result.resolver.searchCalls,2);assert.equal(result.resolver.cardCalls,2);
  assert.equal(calls.length,10);assert.equal(requests.length,6);
  assert.deepEqual(reservations,['search-1','kinobaza-1','search-2','kinobaza-2','tmdb-person','kinobaza-person']);
  assert.equal(result.resolver.possibleIrrelevantSearch,undefined,'a confirmed card suppresses speculative search warning');
  for(const diagnostics of [false,true]) {
    const projected=productMediaResult(discovery,{mykola_media_advice:true,mykola_media_advice_diagnostics:diagnostics});
    const info=presentMediaGroups(projected.rows,{filmId:FILM.id}).find(g=>g.group.key==='megogo');
    assert.equal(info.comparison.availability.symbol,'◐');
    assert.equal(info.comparison.audio.symbol,'+');assert.equal(info.comparison.subtitles.symbol,'+');
    const choices=linkChoicesFor(info);assert.equal(choices.length,1);assert.equal(choices[0].href,HREF);
    const form={recommended_medium:'DVD',purchase_url:'https://example.com/manual'};
    const preview=makePreview(info.transferRow,form);
    assert.equal(form.purchase_url,'https://example.com/manual','preview alone does not mutate form');
    assert.equal(preview.after.purchase_url,HREF);assert.equal(applyPreview(preview,form).purchase_url,HREF);
  }
});

test('cap8 does not gain a profile pair or reserve slots from markup recovery',async()=>{
  const {result,requests,calls}=await run({sourceCap:8});
  assert.equal(result.result,null);assert.equal(calls.length,8);assert.equal(requests.length,4);
  assert.equal(requests.includes(PROFILE),false);
});

for(const options of [{birthday:'20 вересня 1963'},{tail:'<div data-x="a" data-x="b"></div>'}]) test(`person conflict or unrelated HTML corruption still withholds Slevin-shaped claims: ${JSON.stringify(options)}`,async()=>{
  const {result,discovery,calls}=await run(options);
  assert.equal(result.result,null);assert.equal(discovery.rows.length,0);
  assert.equal(result.resolver.directorProfile.status,'unresolved');assert.ok(calls.length<=12);
});

test('conflicting film ID prevents profile verification despite recoverable person page',async()=>{
  const {result,requests,discovery}=await run({stable:'<tr><td>IMDb:</td><td>tt9999999</td></tr>'});
  assert.equal(result.result,null);assert.equal(discovery.rows.length,0);
  assert.equal(requests.includes(PERSON),false);assert.equal(requests.includes(PROFILE),false);
});

test('unsafe film link cannot become a Slevin-shaped usable option after identity recovery',async()=>{
  const {result,discovery}=await run({link:'javascript:alert(1)'});
  assert.equal(result.result.identity.status,'matched');
  const info=presentMediaGroups(discovery.rows,{filmId:FILM.id}).find(g=>g.group.key==='megogo');
  assert.deepEqual(linkChoicesFor(info),[]);
});
