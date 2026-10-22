// Opt-in local control, NOT a deployed endpoint or an alternate source parser.
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { readTmdbJson, projectTmdbIdentityFor } from '../research/grounded-answer-demo/tmdb.mjs';
import { admitKinobazaURL } from '../research/grounded-answer-demo/assisted-kinobaza.mjs';
import { createKinobazaResolver, resolverQueries, tavilySearch } from '../netlify/lib/kinobaza-resolver.mjs';
import { safeSearchDiagnostic } from '../shared/media-advice-diagnostics.mjs';
import { readControlCredentials } from './m4-control-credentials.mjs';
import { describeCandidateURL } from './m4-url-diagnostics.mjs';

const controls = [{ title:'Blade Runner 2049' }, { title:'Mortal Kombat', year:2021 }];
const api = 'https://api.themoviedb.org/3';
const append = 'external_ids,alternative_titles,credits,release_dates,translations';
const val = f => f?.state === 'reported' ? f.value : null;
const normalized = s => typeof s === 'string' ? s.normalize('NFC').trim().toLowerCase() : '';
export async function runControlDiagnostic({ tmdbToken, tavilyKey, fetchImpl = fetch, urlDiagnostic = false } = {}) {
  const totals = { tmdb:0, search:0, cards:0, total:0 }, cases = [];
  const limits=urlDiagnostic?{tmdb:2,search:1,cards:0,total:3}:{tmdb:4,search:4,cards:4,total:12};
  const selectedControls=urlDiagnostic?controls.slice(0,1):controls;
  const base = { execution:'local-diagnostic', buildSha:null, runId:randomUUID(),mode:urlDiagnostic?'url-diagnostic':'identity-controls',limits,
    ...(urlDiagnostic?{accounting:{priorAttempts:14,cumulativeMax:17}}:{}) };
  const missing = [['TMDB_READ_ACCESS_TOKEN',tmdbToken],['TAVILY_API_KEY',tavilyKey]].filter(([,v]) => typeof v !== 'string' || !v || /\s/.test(v)).map(([k])=>k);
  if (missing.length) return { ...base, status:'blocked-missing-local-credentials', missing, counts:totals, cases:selectedControls.map(c=>({film:c.title,status:'not-run',counts:{tmdb:0,search:0,cards:0,total:0}})) };
  for (const control of selectedControls) {
    const count = { tmdb:0, search:0, cards:0, total:0 }, attempts = [], comparisons = [], seen = new Set();
    const signal = AbortSignal.timeout(45_000); let detailURL;
    const queryURL = `${api}/search/movie?query=${encodeURIComponent(control.title)}&language=uk-UA&include_adult=false&page=1${control.year ? `&year=${control.year}` : ''}`;
    const dispatch = async (url, init) => {
      const type = url === queryURL || url === detailURL ? 'tmdb' : url === 'https://api.tavily.com/search' ? 'search' : admitKinobazaURL(url) ? 'cards' : null;
      if (!type || init.redirect !== 'manual' || init.credentials !== 'omit' || init.method !== (type === 'search' ? 'POST' : 'GET') || signal.aborted || count[type] >= 2 || totals[type] >= limits[type] || totals.total >= limits.total) throw Error('diagnostic-boundary');
      count[type]++; count.total++; totals[type]++; totals.total++;
      const attempt = {type,outcome:'dispatched'}; attempts.push(attempt);
      try { const r = await fetchImpl(url,{...init,signal:AbortSignal.any([signal,init.signal].filter(Boolean))}); attempt.httpStatus=r.status; attempt.outcome='response-received'; return r; }
      catch { attempt.outcome='transport-outcome-unknown'; throw Error('diagnostic-transport'); }
    };
    const item = {film:control.title,counts:count,attempts,status:'identity-unresolved'}; cases.push(item);
    try {
      const found = await readTmdbJson(queryURL,tmdbToken,dispatch,{signal});
      if (found.status !== 'ok') { item.status=`identity-search-${found.status}`; continue; }
      const candidates = Array.isArray(found.data?.results) ? found.data.results.filter(c=>Number.isSafeInteger(c.id) && c.id>0 && normalized(c.original_title)===normalized(control.title) && (!control.year || c.release_date?.slice(0,4)===String(control.year))) : [];
      if (candidates.length !== 1) { item.status='identity-search-not-unique'; continue; }
      const selected = candidates[0]; detailURL=`${api}/movie/${selected.id}?language=uk-UA&append_to_response=${append}`;
      const details = await readTmdbJson(detailURL,tmdbToken,dispatch,{signal});
      if (details.status !== 'ok' || !/^tt\d{7,10}$/.test(details.data?.imdb_id ?? '')) { item.status='identity-details-unresolved'; continue; }
      const projection = projectTmdbIdentityFor(details.data,{tmdbId:selected.id,imdbId:details.data.imdb_id});
      if (projection.identity?.status !== 'matched' || normalized(val(projection.metadata.originalTitle))!==normalized(control.title) || control.year && val(projection.metadata.releaseDate)?.slice(0,4)!==String(control.year)) { item.status='identity-details-refused'; continue; }
      const directors=projection.metadata.directors.items ?? [];
      const film={id:`imdb:${details.data.imdb_id}`,tmdbId:selected.id,imdbId:details.data.imdb_id,
        identityTitle:val(projection.metadata.requestedTitle),originalTitle:val(projection.metadata.originalTitle),year:Number(val(projection.metadata.releaseDate)?.slice(0,4)) || null,
        directorCount:projection.metadata.directors.state==='reported'?directors.length:null,
        directorAliases:directors.flatMap(d=>[val(d.name),val(d.originalName)]).filter(Boolean),
        titleAliases:[val(projection.metadata.requestedTitle),val(projection.metadata.originalTitle),...(projection.metadata.alternativeTitles.items??[]).map(a=>val(a.title))].filter(Boolean)};
      item.identity={tmdbId:film.tmdbId,imdbId:film.imdbId,originalTitle:film.originalTitle,year:film.year,directors:film.directorAliases};
      if(urlDiagnostic){
        item.urlDiagnostics=[];
        const provider=tavilySearch(tavilyKey,dispatch,{onCandidateURLs:urls=>{
          item.urlDiagnostics=urls.map((url,index)=>({index:index+1,...describeCandidateURL(url,{secrets:[tmdbToken,tavilyKey]})}));
        }});
        const query=resolverQueries(film)[0];
        if(!query){item.status='not-evaluated-no-established-title';continue;}
        const found=await provider.search(query,{signal});
        item.search=safeSearchDiagnostic(found.status,found.diagnostics);
        item.status=found.status!=='ok'?found.status:found.diagnostics.returned===0?'url-diagnostic-empty-response':'urls-inspected-no-html';
        item.cardIdentity='not-evaluated-no-html-fetch';
        continue;
      }
      const resolver=createKinobazaResolver({apiKey:tavilyKey,onIdentityDiagnostic:d=>comparisons.push(d)});
      const result=await resolver(film,{fetchImpl:dispatch,signal,calls:[],reserve:async stage=>{if(seen.has(stage))throw Error('repeat');seen.add(stage);}});
      item.status=result.status;item.resolver=result.resolver;
      // Full bounded field comparisons exist only during this invocation. Emit
      // only the minimum public identity difference for the failing gate.
      item.cards= comparisons.map(d=>({sourceURL:d.sourceURL,identity:d.status,reason:d.reason,diagnostics:d.diagnostics,truncated:d.truncated,
        ...(d.diagnostics.failedGate==='heading-alias'?{difference:{h1:d.sourceIdentity.h1,expectedPrimaryTitles:[film.identityTitle,film.originalTitle],knownTitleAliasCount:film.titleAliases.length}}:{}),
        ...(d.diagnostics.failedGate==='original-alias'||d.diagnostics.failedGate==='original-scope'?{difference:{h2:d.sourceIdentity.h2,expectedPrimaryTitles:[film.identityTitle,film.originalTitle]}}:{}),
        ...(d.diagnostics.failedGate?.startsWith('director-')?{difference:{directors:d.sourceIdentity.directors,expectedDirectorAliases:d.expected.directorAliases}}:{}),
        ...(d.diagnostics.failedGate==='year-crosswalk'?{difference:{sourceYear:d.sourceIdentity.year,expectedYear:film.year}}:{})}));
    } catch { item.status=signal.aborted?'diagnostic-deadline-no-retry':'diagnostic-failed-no-retry'; }
    finally { comparisons.length=0; }
  }
  const out={...base,status:'completed-controls-not-historical-reconstruction',counts:totals,cases};
  if ([tmdbToken,tavilyKey].some(s=>JSON.stringify(out).includes(s))) return {...base,status:'unsafe-diagnostic-output-withheld',counts:totals,cases:[]};
  return out;
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if (!process.argv.includes('--live-control')) throw Error('Explicit --live-control required; no requests made.');
  let credentials;
  try {
    credentials=process.argv.includes('--credentials-stdin') ? await readControlCredentials(process.stdin) : {tmdbToken:process.env.TMDB_READ_ACCESS_TOKEN,tavilyKey:process.env.TAVILY_API_KEY};
    const result=await runControlDiagnostic({...credentials,urlDiagnostic:process.argv.includes('--url-diagnostic')});
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    if(result.status==='blocked-missing-local-credentials') process.exitCode=2;
  } catch {
    process.stdout.write('{"execution":"local-diagnostic","status":"local-run-failed-no-retry"}\n');
    process.exitCode=2;
  } finally {
    if(credentials){ credentials.tmdbToken=null;credentials.tavilyKey=null; }
  }
}
