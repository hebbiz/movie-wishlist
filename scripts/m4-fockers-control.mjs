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
const IMDb = 'tt0290002', APPEND = 'external_ids,alternative_titles,credits,release_dates,translations';
const val = field => field?.state === 'reported' ? field.value : null;
const caps = Object.freeze({ tmdb:2, search:2, cards:2, tmdbPerson:1, kinobazaPerson:1, total:10 });
const safeKey = value => typeof value === 'string' && value.length > 0 && value.length <= 4096 && !/[\s\p{C}]/u.test(value);
const safeCode = value => typeof value === 'string' && /^[a-z0-9-]{1,120}$/.test(value) ? value : null;
function literal(value, secrets) {
  return typeof value === 'string' && value.trim() && value.length <= 500 && !/[\p{C}<>]/u.test(value) &&
    !/https?:|\b(?:authorization|bearer|api[_ -]?key|token|password|secret)\s*[=: ]/i.test(value) &&
    !secrets.some(secret => value.includes(secret)) ? value : null;
}
// Read a clone only; leave the original adapter body/decision intact. A local
// observation failure does not authorize another request or change admission.
async function searchObservation(response, query, secrets, signal) {
  const observation = { ...safeSearchCorrelation({ query }, { secrets }), returnedURLs:[], responseObservation:'unknown' };
  if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') || !response.body ||
      Number(response.headers.get('content-length')) > 512 * 1024) return observation;
  const clone = response.clone(), reader = clone.body.getReader();
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
    if (!valid) return observation;
    return { ...safeSearchCorrelation({query,requestId:data.request_id,responseQuery:data.query},{secrets}),
      returnedURLs:data.results.map((item,index) => ({ index:index+1,url:safeSearchCardURL(item.url,{secrets}), admitted:admitKinobazaURL(item.url)!==null })),
      responseObservation:'bounded-current-response' };
  } catch { return observation; }
  finally { void reader.cancel().catch(()=>{}); for (const chunk of chunks) chunk.fill(0); }
}
function language(field, secrets) {
  return { state:safeCode(field?.state) ?? 'unknown', evidence:(field?.evidence ?? []).slice(0,8).map(item => ({label:literal(item.label,secrets),literal:literal(item.literal,secrets),state:safeCode(item.state)})) };
}

export async function fockersControl({tmdbToken,tavilyKey}, fetchImpl = fetch) {
  const counts = {tmdb:0,search:0,cards:0,tmdbPerson:0,kinobazaPerson:0,total:0}, attempts=[], reservations=[], searches=[], readCards=[], identityObservations=[];
  const result = {execution:'local-diagnostic',historicalReconstruction:false,buildSha:null,runId:randomUUID(),startedAt:new Date().toISOString(),
    limits:caps,counts,attempts,reservations,searches,readCards};
  const started = performance.now(), signal = AbortSignal.timeout(55_000), secrets=[tmdbToken,tavilyKey].filter(safeKey);
  let film, detailsURL; const admittedUnion = new Set(), calls=[];
  const done = (status,extra={}) => ({...result,status,elapsedMs:Math.round(performance.now()-started),...extra});
  if (![tmdbToken,tavilyKey].every(safeKey)) return done('invalid-local-credentials-no-requests');
  const findURL = `${API}/find/${IMDb}?external_source=imdb_id&language=uk-UA`;
  const reserve = async stage => {
    if (signal.aborted || reservations.length >= caps.total || reservations.includes(stage) ||
        !/^(?:tmdb-find|tmdb-details|search-[12]|kinobaza-[12]|tmdb-person|kinobaza-person)$/.test(stage)) throw Error('control-reservation-boundary');
    reservations.push(stage);
  };
  const send = async (url,init) => {
    const personURL = film?.directorCount === 1 && film.directorPeople?.length === 1 ? `${API}/person/${film.directorPeople[0].personId}?language=en-US&append_to_response=external_ids` : null;
    const type = url === findURL || url === detailsURL ? 'tmdb' : url === SEARCH ? 'search' : admitKinobazaURL(url) ? 'cards' : url === personURL ? 'tmdbPerson' : admitDirectorProfileURL(url) ? 'kinobazaPerson' : null;
    const headers = new Headers(init.headers);
    if (!type || signal.aborted || init.redirect !== 'manual' || init.credentials !== 'omit' || init.method !== (type === 'search' ? 'POST':'GET') ||
        counts.total >= caps.total || counts[type] >= caps[type] || ['cards','kinobazaPerson'].includes(type) && (headers.has('authorization') || headers.has('cookie'))) throw Error('control-source-boundary');
    counts[type]++; counts.total++;
    const attempt = {type,outcome:'dispatched'}; attempts.push(attempt);
    if (type === 'cards') readCards.push({url:safeSearchCardURL(url,{secrets}),rankedCandidatesBeforeRead:rankedCandidates(admittedUnion,film).map(candidate=>safeSearchCardURL(candidate,{secrets}))});
    let query = null;
    if (type === 'search') try { query=JSON.parse(init.body)?.query; } catch {}
    try {
      const response=await fetchImpl(url,{...init,signal:AbortSignal.any([signal,init.signal].filter(Boolean))});
      attempt.httpStatus=response.status;attempt.outcome='response-received';
      if (type === 'search') searches.push(await searchObservation(response,query,secrets,signal));
      return response;
    } catch { attempt.outcome='transport-outcome-unknown'; if(type==='search') searches.push({...safeSearchCorrelation({query},{secrets}),returnedURLs:[],responseObservation:'unknown'}); throw Error('control-transport'); }
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
    if(film.year!==2004||!film.originalTitle)return done('expected-film-context-unresolved');
    const resolver=createKinobazaResolver({apiKey:tavilyKey,
      searchFactory:(key,transport)=>tavilySearch(key,transport,{onCandidateURLs:urls=>{for(const url of admittedCandidates(urls.map(url=>({url})))??[])admittedUnion.add(url);}}),
      onIdentityDiagnostic:observation=>identityObservations.push(observation)});
    const resolved=await resolver(film,{reserve,fetchImpl:send,calls,signal,sourceCap:10,tmdbToken,diagnostics:true,diagnosticSecrets:secrets});
    for(const [index,card] of resolved.resolver.cards.entries()) {
      const readCard=readCards[index]; if(!readCard)continue;
      const observations=identityObservations.filter(item=>item.sourceURL===readCard.url), observed=observations.at(-1);
      Object.assign(readCard,{identity:card.identity,reason:card.reason,diagnostics:card.diagnostics,extraction:card.extraction,
        observed:{h1:(observed?.sourceIdentity?.h1??[]).map(value=>literal(value,secrets)),h2:(observed?.sourceIdentity?.h2??[]).map(value=>literal(value,secrets)),
          year:observed?.sourceIdentity?.year??null,directors:(observed?.sourceIdentity?.directors??[]).map(value=>literal(value,secrets)),
          completeness:observed?.sourceTitleCompleteness??null,truncated:typeof observed?.truncated==='boolean'?observed.truncated:null}});
    }
    const discovery=composeDiscovery(film,{tmdb:{status:'not-requested',result:null},motn:{status:'not-requested',result:null},kinobaza:resolved});
    return done('completed-current-control-not-historical-reconstruction',{resolver:resolved.resolver,
      admittedRankedUnion:rankedCandidates(admittedUnion,film).map(url=>safeSearchCardURL(url,{secrets})),
      projection:{rows:discovery.rows.length,providers:discovery.rows.map(row=>({provider:row.provider.key,country:row.country,
        audio:language(row.kinobazaLocalization?.audio,secrets),subtitles:language(row.kinobazaLocalization?.subtitles,secrets),
        link:{kind:safeCode(row.link?.kind)??'unknown',hasURL:typeof row.link?.href==='string',transferable:row.link?.transferable===true,extraction:safeCode(row.linkAudit?.extraction)}}))}});
  } catch {return done('control-not-confirmed-no-retry');}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try {const credentials=await readControlCredentials(process.stdin);let out=await fockersControl(credentials);
    const serialized=JSON.stringify(out);if(serialized.length>128*1024||Object.values(credentials).some(secret=>serialized.includes(secret)))out={execution:'local-diagnostic',status:'unsafe-result-withheld-do-not-repeat'};
    process.stdout.write(JSON.stringify(out)+'\n');credentials.tmdbToken=null;credentials.tavilyKey=null;
  }catch{process.stdout.write(JSON.stringify({execution:'local-diagnostic',status:'local-control-not-confirmed-do-not-repeat'})+'\n');process.exitCode=1;}
}
