// One explicit, memory-only local control. No application session, persistence,
// prefilled card URL, retry, source /search, MOTN or platform navigation.
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { readControlCredentials } from './m4-control-credentials.mjs';
import { readTmdbJson, projectTmdbIdentityFor } from '../research/grounded-answer-demo/tmdb.mjs';
import { projectDirectorPeople } from '../shared/director-alias-crosswalk.mjs';
import { projectFilmIdentityContext } from '../shared/film-identity-context.mjs';
import { createKinobazaResolver, tavilySearch, rankedCandidates, admittedCandidates } from '../netlify/lib/kinobaza-resolver.mjs';
import { admitKinobazaURL } from '../research/grounded-answer-demo/assisted-kinobaza.mjs';
import { admitDirectorProfileURL } from '../netlify/lib/director-profile.mjs';
import { safeSearchCorrelation, safeSearchCardURL } from '../shared/media-search-relevance-diagnostic.mjs';
import { composeDiscovery } from '../research/grounded-answer-demo/discovery.mjs';

const API = 'https://api.themoviedb.org/3', SEARCH = 'https://api.tavily.com/search';
const APPEND = 'external_ids,alternative_titles,credits,release_dates,translations';
export const cap12ControlFilms = Object.freeze([
  {title:'Meet the Fockers',year:2004,imdbId:'tt0290002'},
  {title:'Alien',year:1979,imdbId:'tt0078748'},
  {title:'Mad Max: Fury Road',year:2015,imdbId:'tt1392190'},
  {title:'Dune: Part Two',year:2024,imdbId:'tt15239678'},
  {title:'Gladiator II',year:2024,imdbId:'tt9218128'},
  {title:'Kong: Skull Island',year:2017,imdbId:'tt3731562'},
  {title:'Klaus',year:2019,imdbId:'tt4729430'},
  {title:'The Pursuit of Happyness',year:2006,imdbId:'tt0454921'},
].map(Object.freeze));
const val = field => field?.state === 'reported' ? field.value : null;
const caps = Object.freeze({ tmdb:2, search:2, cards:2, tmdbPerson:1, kinobazaPerson:1, total:10 });
const safeKey = value => typeof value === 'string' && value.length > 0 && value.length <= 4096 && !/[\s\p{C}]/u.test(value);
const safeCode = value => typeof value === 'string' && /^[a-z0-9-]{1,120}$/.test(value) ? value : null;
// Tavily's documented depth rates, not a claim about charges for a particular
// failed call or account invoice. Actual response usage stays separate/unknown.
const declaredDepthCredits=Object.freeze({basic:1,advanced:2});
function requestAccounting(body){
  let payload;try{payload=JSON.parse(body);}catch{}
  const searchDepth=typeof payload?.search_depth==='string'&&Object.hasOwn(declaredDepthCredits,payload.search_depth)?payload.search_depth:'unknown';
  return {searchDepth,declaredCreditsPerRequest:declaredDepthCredits[searchDepth]??null,
    mode:payload?.exact_match===true?'reserve-exact':'normal',exactMatch:payload?.exact_match===true};
}
function returnedAccounting(data){
  const usage=data?.usage,credits=usage?.credits;
  const valid=typeof credits==='number'&&Number.isFinite(credits)&&credits>=0&&credits<=1000;
  const invalid=usage!==undefined&&usage!==null&&(!usage||typeof usage!=='object'||Array.isArray(usage)||credits!==undefined&&credits!==null&&!valid);
  const responseTime=data?.response_time;
  return {returnedUsage:{state:valid?'reported':invalid?'invalid':'not-returned',credits:valid?credits:null},
    providerResponseTimeSeconds:typeof responseTime==='number'&&Number.isFinite(responseTime)&&responseTime>=0&&responseTime<=3600?responseTime:null};
}
function summarizeTavily(searches){
  const depthAttempts={basic:0,advanced:0,unknown:0};let knownCredits=0,reportedRequests=0,reportedCredits=0,elapsedMs=0;
  for(const search of searches){const depth=Object.hasOwn(depthAttempts,search.searchDepth??'')?search.searchDepth:'unknown';depthAttempts[depth]++;
    knownCredits+=declaredDepthCredits[depth]??0;if(search.returnedUsage?.state==='reported'){reportedRequests++;reportedCredits+=search.returnedUsage.credits;}
    if(Number.isFinite(search.elapsedMs))elapsedMs+=search.elapsedMs;}
  const depthAccounting=Object.fromEntries(Object.entries(depthAttempts).map(([depth,attempts])=>{
    const entries=searches.filter(search=>(Object.hasOwn(depthAttempts,search.searchDepth??'')?search.searchDepth:'unknown')===depth),reported=entries.filter(search=>search.returnedUsage?.state==='reported');
    return [depth,{attempts,declaredCreditsSubtotal:declaredDepthCredits[depth]===undefined?null:attempts*declaredDepthCredits[depth],
      elapsedMs:entries.reduce((sum,search)=>sum+(Number.isFinite(search.elapsedMs)?search.elapsedMs:0),0),
      returnedUsage:{reportedRequests:reported.length,unknownRequests:attempts-reported.length,reportedCreditsSubtotal:reported.reduce((sum,search)=>sum+search.returnedUsage.credits,0),complete:reported.length===attempts}}];
  }));
  return {scope:'actual-source-http-attempts-only-replay-excluded',attempts:searches.length,depthAttempts,depthAccounting,
    declaredCredits:{basis:'documented-depth-rate-not-billed-usage',knownSubtotal:knownCredits,total:depthAttempts.unknown?null:knownCredits},
    returnedUsage:{reportedRequests,unknownRequests:searches.length-reportedRequests,reportedCreditsSubtotal:reportedCredits,complete:reportedRequests===searches.length},
    elapsedMs};
}
function literal(value, secrets) {
  return typeof value === 'string' && value.trim() && value.length <= 500 && !/[\p{C}<>]/u.test(value) &&
    !/https?:|\b(?:authorization|bearer|api[_ -]?key|token|password|secret)\s*[=: ]/i.test(value) &&
    !secrets.some(secret => value.includes(secret)) ? value : null;
}
// Read a clone only; leave the original adapter body/decision intact. A local
// observation failure does not authorize another request or change admission.
async function searchObservation(response, query, secrets, signal) {
  const observation = { ...safeSearchCorrelation({ query }, { secrets }), returnedURLs:[], responseObservation:'unknown',
    returnedUsage:{state:'unavailable',credits:null},providerResponseTimeSeconds:null };
  if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') || !response.body ||
      Number(response.headers.get('content-length')) > 512 * 1024) return observation;
  let reader;try{reader=response.clone().body.getReader();}catch{return observation;}
  let bytes = 0; const chunks = [];
  const read = promise => {
    if (signal.aborted) throw Error('observation-timeout');
    let listener;
    return Promise.race([promise, new Promise((_,reject) => { listener = () => reject(Error('observation-timeout')); signal.addEventListener('abort',listener,{once:true}); })])
      .finally(() => signal.removeEventListener('abort',listener));
  };
  try {
    for (;;) { const part = await read(reader.read()); if (part.done) break; bytes += part.value.byteLength; if (bytes > 512 * 1024) throw Error('observation-size'); chunks.push(Buffer.from(part.value)); }
    const body = new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,bytes));
    if (secrets.some(secret => body.includes(secret))) return { ...observation, responseObservation:'unsafe-source-content-withheld' };
    const data = JSON.parse(body);
    const valid = data && !Array.isArray(data) && Array.isArray(data.results) && data.results.length <= 5 && data.results.every(item => item && !Array.isArray(item) && typeof item.url === 'string');
    const accounting=returnedAccounting(data);
    if (!valid) return {...observation,...accounting};
    return { ...safeSearchCorrelation({query,requestId:data.request_id,responseQuery:data.query},{secrets}),
      returnedURLs:data.results.map((item,index) => ({ index:index+1,url:safeSearchCardURL(item.url,{secrets}), admitted:admitKinobazaURL(item.url)!==null })),
      responseObservation:'bounded-current-response',...accounting };
  } catch { return observation; }
  finally { void reader.cancel().catch(()=>{}); for (const chunk of chunks) chunk.fill(0); }
}
function language(field, secrets) {
  return { state:safeCode(field?.state) ?? 'unknown', evidence:(field?.evidence ?? []).slice(0,8).map(item => ({label:literal(item.label,secrets),literal:literal(item.literal,secrets),state:safeCode(item.state)})) };
}

// A complete clone is held in RAM solely until this case's cap10 replay ends.
// Never serialize it, place it in the result, or dispatch on a replay cache miss.
async function responseSnapshot(response, signal, maxBytes) {
  const snapshot={status:response.status,headers:Object.fromEntries(['content-type','content-length'].map(name=>[name,response.headers.get(name)]).filter(([,value])=>value!==null)),bytes:null};
  let reader;try{reader=response.clone().body?.getReader();}catch{return snapshot;}
  if(!reader){snapshot.bytes=Buffer.alloc(0);return snapshot;}
  const chunks=[];let size=0,listener;
  const aborted=new Promise((_,reject)=>{listener=()=>reject(Error('snapshot-unavailable'));if(signal.aborted)listener();else signal.addEventListener('abort',listener,{once:true});});
  try{for(;;){const part=await Promise.race([reader.read(),aborted]);if(part.done)break;size+=part.value.byteLength;if(size>maxBytes)throw Error('snapshot-unavailable');chunks.push(Buffer.from(part.value));}
    snapshot.bytes=Buffer.concat(chunks,size);return snapshot;
  }catch{return snapshot;}
  finally{signal.removeEventListener('abort',listener);void reader.cancel().catch(()=>{});for(const chunk of chunks)chunk.fill(0);}
}
const requestKey=(url,init)=>JSON.stringify([url,init.method,init.body??null]);
const snapshotResponse=snapshot=>new Response([204,205,304].includes(snapshot.status)?null:Buffer.from(snapshot.bytes),{status:snapshot.status,headers:snapshot.headers});

async function filmControl({tmdbToken,tavilyKey}, fetchImpl, control, {sourceCap=10,compareCap10=false}={}) {
  const IMDb=control.imdbId, limits=sourceCap===12?{...caps,search:3,cards:3}:caps;
  const counts = {tmdb:0,search:0,cards:0,tmdbPerson:0,kinobazaPerson:0,total:0}, attempts=[], reservations=[], searches=[], readCards=[], identityObservations=[];
  const result = {execution:'local-diagnostic',historicalReconstruction:false,buildSha:null,runId:randomUUID(),startedAt:new Date().toISOString(),
    ...(compareCap10?{requested:{title:control.title,year:control.year,imdbId:IMDb}}:{}),
    ...(compareCap10?{configuredResolverCap:sourceCap,serverLedgerCapAttested:false,omittedBaselineSources:['tmdb-providers','motn-title']}:{}),limits,counts,attempts,reservations,searches,readCards};
  const sourceDeadlineMs=compareCap10?45_000:55_000;
  const started = performance.now(), signal = AbortSignal.timeout(sourceDeadlineMs), secrets=[tmdbToken,tavilyKey].filter(safeKey);
  if(compareCap10)result.sourceDeadlineMs=sourceDeadlineMs;
  let film, detailsURL, latestSearchURLs=[]; const admittedUnion = new Set(), calls=[], snapshots=new Map();
  const done = (status,extra={}) => ({...result,status,elapsedMs:Math.round(performance.now()-started),tavilyAccounting:summarizeTavily(searches),...extra});
  if (![tmdbToken,tavilyKey].every(safeKey)) return done('invalid-local-credentials-no-requests');
  const findURL = `${API}/find/${IMDb}?external_source=imdb_id&language=uk-UA`;
  const reserve = async stage => {
    const stagePattern=sourceCap===12?/^(?:tmdb-find|tmdb-details|search-[123]|kinobaza-[123]|tmdb-person|kinobaza-person)$/:/^(?:tmdb-find|tmdb-details|search-[12]|kinobaza-[12]|tmdb-person|kinobaza-person)$/;
    if (signal.aborted || reservations.length >= limits.total || reservations.includes(stage) || !stagePattern.test(stage)) throw Error('control-reservation-boundary');
    reservations.push(stage);
  };
  const send = async (url,init) => {
    const personURL = film?.directorCount === 1 && film.directorPeople?.length === 1 ? `${API}/person/${film.directorPeople[0].personId}?language=en-US&append_to_response=external_ids` : null;
    const type = url === findURL || url === detailsURL ? 'tmdb' : url === SEARCH ? 'search' : admitKinobazaURL(url) ? 'cards' : url === personURL ? 'tmdbPerson' : admitDirectorProfileURL(url) ? 'kinobazaPerson' : null;
    const headers = new Headers(init.headers);
    if (!type || signal.aborted || init.redirect !== 'manual' || init.credentials !== 'omit' || init.method !== (type === 'search' ? 'POST':'GET') ||
        counts.total >= limits.total || counts[type] >= limits[type] || ['cards','kinobazaPerson'].includes(type) && (headers.has('authorization') || headers.has('cookie'))) throw Error('control-source-boundary');
    counts[type]++; counts.total++;
    const attempt = {type,outcome:'dispatched'}; attempts.push(attempt);
    if (type === 'cards') {const reserveExact=reservations.at(-1)==='kinobaza-3',pool=reserveExact?latestSearchURLs:admittedUnion;
      const ranked=rankedCandidates(pool,film),alreadyRead=new Set(readCards.map(card=>card.url));
      readCards.push({url:safeSearchCardURL(url,{secrets}),rankedCandidatesBeforeRead:ranked.map(candidate=>safeSearchCardURL(candidate,{secrets})),
        ...(compareCap10?{candidatePool:reserveExact?'reserve-search-only':'normal-shared-union',eligibleUnreadBeforeRead:ranked.filter(candidate=>!alreadyRead.has(candidate)).map(candidate=>safeSearchCardURL(candidate,{secrets}))}:{})});}
    let query = null;
    if (type === 'search') try { query=JSON.parse(init.body)?.query; } catch {}
    const searchRequest=type==='search'?requestAccounting(init.body):null,attemptStarted=performance.now();
    const record=compareCap10&&['search','cards','tmdbPerson','kinobazaPerson'].includes(type)&&(!['search','cards'].includes(type)||counts[type]<=2);
    let recorded=false;
    const recordSnapshot=snapshot=>{const key=requestKey(url,init),queue=snapshots.get(key)??[];queue.push(snapshot);snapshots.set(key,queue);recorded=true;};
    try {
      const response=await fetchImpl(url,{...init,signal:AbortSignal.any([signal,init.signal].filter(Boolean))});
      attempt.httpStatus=response.status;attempt.outcome='response-received';
      if(record)recordSnapshot(await responseSnapshot(response,AbortSignal.any([signal,init.signal].filter(Boolean)),type==='search'?512*1024:2*1024*1024));
      if (type === 'search') searches.push({...await searchObservation(response,query,secrets,signal),...searchRequest,elapsedMs:Math.round(performance.now()-attemptStarted)});
      return response;
    } catch { attempt.outcome='transport-outcome-unknown';if(record&&!recorded)recordSnapshot({transportError:true}); if(type==='search') searches.push({...safeSearchCorrelation({query},{secrets}),returnedURLs:[],responseObservation:'unknown',
      ...searchRequest,elapsedMs:Math.round(performance.now()-attemptStarted),returnedUsage:{state:'unavailable',credits:null},providerResponseTimeSeconds:null}); throw Error('control-transport'); }
  };
  const read = async (stage,url) => {await reserve(stage);const call={stage,status:'attempt-reserved'};calls.push(call);const response=await readTmdbJson(url,tmdbToken,send,{signal});call.status=response.status;return response;};
  try {
    const found=await read('tmdb-find',findURL), candidates=found.data?.movie_results;
    if(found.status!=='ok'||!Array.isArray(candidates)||candidates.length!==1||!Number.isSafeInteger(candidates[0]?.id)||candidates[0].id<1)return done('tmdb-find-unresolved');
    const tmdbId=candidates[0].id;detailsURL=`${API}/movie/${tmdbId}?language=uk-UA&append_to_response=${APPEND}`;
    const details=await read('tmdb-details',detailsURL);
    if(details.status!=='ok')return done('tmdb-details-unresolved');
    const projected=projectTmdbIdentityFor(details.data,{tmdbId,imdbId:IMDb});
    if(projected.identity.status!=='matched')return done('tmdb-identity-refused');
    const metadata=projected.metadata, release=val(metadata.releaseDate), directors=metadata.directors.items ?? [];
    const identityContext=projectFilmIdentityContext(projected);
    film={id:`imdb:${IMDb}`,imdbId:IMDb,tmdbId,title:val(metadata.requestedTitle),identityTitle:val(metadata.requestedTitle),originalTitle:val(metadata.originalTitle),
      year:/^\d{4}-\d{2}-\d{2}$/.test(release??'')?Number(release.slice(0,4)):null,
      directorCount:metadata.directors.state==='reported'?directors.length:null,directorPeople:projectDirectorPeople(metadata.directors),
      directorAliases:directors.flatMap(d=>[val(d.name),val(d.originalName)]).filter(Boolean),identityContext,
      titleAliases:[...new Set([val(metadata.requestedTitle),val(metadata.originalTitle),...(identityContext?.titleEvidence??[]).map(item=>item.title)].filter(Boolean))]};
    result.film={imdbId:IMDb,tmdbId,title:literal(film.identityTitle,secrets),originalTitle:literal(film.originalTitle,secrets),year:film.year,
      directorCount:film.directorCount,directorPeople:film.directorPeople.map(person=>({namespace:'tmdb:person',personId:person.personId,names:person.names.map(name=>literal(name,secrets))})),
      titleAliasCount:film.titleAliases.length,titleAliases:film.titleAliases.slice(0,100).map(name=>literal(name,secrets)),titleAliasesTruncated:film.titleAliases.length>100};
    if(film.year!==control.year||!film.originalTitle)return done('expected-film-context-unresolved');
    // The two intentionally omitted provider stages consume their ordinary
    // runtime slots, but are never actual requests in this source-only control.
    if(compareCap10)calls.push({stage:'tmdb-providers',status:'omitted-no-request'},{stage:'motn-title',status:'omitted-no-request'});
    const resolver=createKinobazaResolver({apiKey:tavilyKey,
      searchFactory:(key,transport)=>tavilySearch(key,transport,{onCandidateURLs:urls=>{latestSearchURLs=admittedCandidates(urls.map(url=>({url})))??[];for(const url of latestSearchURLs)admittedUnion.add(url);}}),
      onIdentityDiagnostic:observation=>identityObservations.push(observation)});
    const resolved=await resolver(film,{reserve,fetchImpl:send,calls,signal,sourceCap,tmdbToken,diagnostics:true,diagnosticSecrets:secrets});
    for(const [index,card] of resolved.resolver.cards.entries()) {
      const readCard=readCards[index]; if(!readCard)continue;
      const observations=identityObservations.filter(item=>item.sourceURL===readCard.url), observed=observations.at(-1);
      Object.assign(readCard,{identity:card.identity,reason:card.reason,diagnostics:card.diagnostics,extraction:card.extraction,
        observed:{h1:(observed?.sourceIdentity?.h1??[]).map(value=>literal(value,secrets)),h2:(observed?.sourceIdentity?.h2??[]).map(value=>literal(value,secrets)),
          year:observed?.sourceIdentity?.year??null,directors:(observed?.sourceIdentity?.directors??[]).map(value=>literal(value,secrets)),
          completeness:observed?.sourceTitleCompleteness??null,truncated:typeof observed?.truncated==='boolean'?observed.truncated:null}});
    }
    const discovery=composeDiscovery(film,{tmdb:{status:'not-requested',result:null},motn:{status:'not-requested',result:null},kinobaza:resolved});
    const liveElapsedMs=Math.round(performance.now()-started);let counterfactualCap10;
    if(compareCap10){
      const replayStarted=performance.now();
      let missing=false;const replayReservations=[],replayedReads=[],replaySignal=AbortSignal.timeout(55_000),replayPositions=new Map();
      const replayCalls=[{stage:'tmdb-find',status:'projected-current-identity'},{stage:'tmdb-details',status:'projected-current-identity'},{stage:'tmdb-providers',status:'omitted-no-request'},{stage:'motn-title',status:'omitted-no-request'}];
      const replayResolver=createKinobazaResolver({apiKey:tavilyKey});
      const replayed=await replayResolver(film,{sourceCap:10,tmdbToken,calls:replayCalls,signal:replaySignal,reserve:async stage=>{
        if(replayReservations.includes(stage)||replayCalls.length>=10||!/^(?:search-[12]|kinobaza-[12]|tmdb-person|kinobaza-person)$/.test(stage))throw Error('replay-budget');replayReservations.push(stage);
      },fetchImpl:async(url,init)=>{const key=requestKey(url,init),position=replayPositions.get(key)??0,snapshot=snapshots.get(key)?.[position];replayPositions.set(key,position+1);replayedReads.push({type:url===SEARCH?'search':admitKinobazaURL(url)?'cards':url.startsWith(API)?'tmdbPerson':'kinobazaPerson',
        ...(admitKinobazaURL(url)?{url:safeSearchCardURL(url,{secrets})}:{})});
        if(!snapshot||!snapshot.transportError&&!snapshot.bytes){missing=true;throw Error('unrecorded-response-no-live-request');}
        if(snapshot.transportError)throw Error('recorded-transport-error');return snapshotResponse(snapshot);
      }});
      const replayCards=replayedReads.filter(item=>item.type==='cards');
      counterfactualCap10={execution:'memory-replay-current-first-two-slots-not-independent-live',externalRequests:0,complete:!missing,
        elapsedMs:Math.round(performance.now()-replayStarted),
        status:missing?'unknown-unrecorded-source':replayed.status,reservations:replayReservations,replayedSourceReads:replayedReads.length,
        reads:replayedReads,confirmed:missing?[]:replayed.resolver.cards.flatMap((card,index)=>card.identity==='matched'&&replayCards[index]?.url?[replayCards[index].url]:[]),
        ...(missing?{}:{cards:replayed.resolver.cards.map(card=>({identity:card.identity,reason:card.reason}))})};
    }
    return done('completed-current-control-not-historical-reconstruction',{resolver:resolved.resolver,...(counterfactualCap10?{liveElapsedMs,counterfactualCap10}:{}),
      admittedRankedUnion:rankedCandidates(admittedUnion,film).map(url=>safeSearchCardURL(url,{secrets})),
      projection:{rows:discovery.rows.length,providers:discovery.rows.map(row=>({provider:row.provider.key,country:row.country,
        audio:language(row.kinobazaLocalization?.audio,secrets),subtitles:language(row.kinobazaLocalization?.subtitles,secrets),
        link:{kind:safeCode(row.link?.kind)??'unknown',hasURL:typeof row.link?.href==='string',transferable:row.link?.transferable===true,extraction:safeCode(row.linkAudit?.extraction)}}))}});
  } catch {return done('control-not-confirmed-no-retry');}
  finally{for(const queue of snapshots.values())for(const snapshot of queue)snapshot.bytes?.fill(0);snapshots.clear();}
}

export const fockersControl=(credentials,fetchImpl=fetch)=>filmControl(credentials,fetchImpl,cap12ControlFilms[0]);
function compactControl(result){return {execution:result.execution,historicalReconstruction:false,buildSha:null,runId:result.runId,requested:result.requested,
  film:result.film?{imdbId:result.film.imdbId,tmdbId:result.film.tmdbId,title:result.film.title,originalTitle:result.film.originalTitle,year:result.film.year,
    directorPeople:result.film.directorPeople,titleAliasCount:result.film.titleAliasCount}:null,status:result.status,configuredResolverCap:12,serverLedgerCapAttested:false,omittedBaselineSources:result.omittedBaselineSources,
  counts:result.counts,tavilyAccounting:result.tavilyAccounting,sourceDeadlineMs:result.sourceDeadlineMs,attempts:result.attempts.map(attempt=>({type:attempt.type,outcome:attempt.outcome,httpStatus:attempt.httpStatus??null})),liveElapsedMs:result.liveElapsedMs??result.elapsedMs,reservations:result.reservations,searches:result.searches,
  readCards:result.readCards.map(card=>({url:card.url,candidatePool:card.candidatePool,rankedCandidatesBeforeRead:card.rankedCandidatesBeforeRead,eligibleUnreadBeforeRead:card.eligibleUnreadBeforeRead,
    identity:card.identity??'unknown',reason:card.reason??null,extraction:card.extraction??'unknown',observed:card.observed??null,
    failedGate:card.diagnostics?.failedGate??null,strategy:card.diagnostics?.strategy??null,comparisons:card.diagnostics?.comparisons??null})),
  resolver:result.resolver?{status:result.resolver.status,searchCalls:result.resolver.searchCalls,cardCalls:result.resolver.cardCalls,candidates:result.resolver.candidates,unexamined:result.resolver.unexamined,
    searches:result.resolver.searches,directorProfile:result.resolver.directorProfile}:null,
  projection:result.projection?{rows:result.projection.rows,providers:result.projection.providers.map(row=>({provider:row.provider,country:row.country,audio:row.audio.state,subtitles:row.subtitles.state,link:row.link}))}:null,
  counterfactualCap10:result.counterfactualCap10??{execution:'memory-replay-current-first-two-slots-not-independent-live',externalRequests:0,complete:false,status:'unknown-control-not-completed'}};}
export async function cap12ControlSeries(credentials,fetchImpl=fetch,{onCase,films=cap12ControlFilms}={}){
  if(!Array.isArray(films)||!films.length||films.length>cap12ControlFilms.length||new Set(films.map(f=>f?.imdbId)).size!==films.length||
    films.some(f=>!cap12ControlFilms.some(allowed=>allowed.imdbId===f?.imdbId&&allowed.year===f?.year)))throw Error('invalid-local-study');
  const cases=[],counts={tmdb:0,search:0,cards:0,tmdbPerson:0,kinobazaPerson:0,total:0};
  for(const film of films){const full=await filmControl(credentials,fetchImpl,film,{sourceCap:12,compareCap10:true}),compact=compactControl(full);
    cases.push(compact);for(const type of Object.keys(counts))counts[type]+=full.counts[type];if(typeof onCase==='function')await onCase(compact);}
  return {execution:'local-diagnostic',historicalReconstruction:false,buildSha:null,status:'completed-one-pass-cap12-series-no-automatic-rerun',counts,
    tavilyAccounting:summarizeTavily(cases.flatMap(result=>result.searches)),cases};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try {const credentials=await readControlCredentials(process.stdin);const series=process.argv.length===3&&process.argv[2]==='--cap12-series';
    if(process.argv.length>2&&!series)throw Error('invalid-local-mode');
    const emit=value=>{const serialized=JSON.stringify(value);process.stdout.write(serialized.length>128*1024||Object.values(credentials).some(secret=>serialized.includes(secret))?
      JSON.stringify({execution:'local-diagnostic',status:'unsafe-result-withheld-do-not-repeat'})+'\n':serialized+'\n');};
    let out=series?await cap12ControlSeries(credentials,fetch,{onCase:emit}):await fockersControl(credentials);
    if(series)out={...out,cases:undefined,casesCompleted:out.cases.length,kind:'series-summary',counterfactualExternalRequests:0};
    const serialized=JSON.stringify(out);if(serialized.length>128*1024||Object.values(credentials).some(secret=>serialized.includes(secret)))out={execution:'local-diagnostic',status:'unsafe-result-withheld-do-not-repeat'};
    process.stdout.write(JSON.stringify(out)+'\n');credentials.tmdbToken=null;credentials.tavilyKey=null;
  }catch{process.stdout.write(JSON.stringify({execution:'local-diagnostic',status:'local-control-not-confirmed-do-not-repeat'})+'\n');process.exitCode=1;}
}
