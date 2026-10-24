// Opt-in local series worker. Credentials/private context travel only over stdin.
// Not an application endpoint, catalogue, prefilled URL resolver or evidence archive.
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parse } from 'parse5';
import { readTmdbJson, projectTmdbIdentityFor } from '../research/grounded-answer-demo/tmdb.mjs';
import { admitKinobazaURL, fetchAssistedKinobaza } from '../research/grounded-answer-demo/assisted-kinobaza.mjs';
import { createKinobazaResolver, tavilySearch } from '../netlify/lib/kinobaza-resolver.mjs';
import { describeCandidateURL } from './m4-url-diagnostics.mjs';
import { kinobazaPublicSearch, isKinobazaSearchURL } from '../netlify/lib/kinobaza-public-search.mjs';
import { projectDirectorPeople } from '../shared/director-alias-crosswalk.mjs';

export const practicalFilms = Object.freeze([
  { title: 'Blade Runner 2049', year: 2017 }, { title: 'Mortal Kombat', year: 2021 },
  { title: 'Alien', year: 1979 }, { title: 'Oppenheimer', year: 2023 }, { title: 'Dune: Part Two', year: 2024 },
]);
const normalize = s => typeof s === 'string' ? s.normalize('NFC').replace(/\s+/gu, ' ').trim().toLowerCase() : '';
const val = f => f?.state === 'reported' ? f.value : null;
const api = 'https://api.themoviedb.org/3';
const append = 'external_ids,alternative_titles,credits,release_dates,translations';
const attr = (n, key) => n.attrs?.find(a => a.name === key)?.value;
const text = n => (n.childNodes ?? []).map(c => c.nodeName === '#text' ? c.value : ['script','style','template','noscript','iframe'].includes(c.tagName) ? '' : text(c)).join(' ').replace(/\s+/gu, ' ').trim();
const personURL = s => typeof s === 'string' && /^https:\/\/kinobazaua\.com\/persons\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) ? s : null;
const nodes = html => { const out = [], stack = [parse(html, { sourceCodeLocationInfo: true })]; while (stack.length && out.length < 100_000) { const n = stack.pop(); out.push(n); stack.push(...n.childNodes ?? []); } return out; };

// A few public identity fields, never an HTML dump, search response, snippet or offer archive.
export function inspectPublicIdentity(html, url) {
  const profile = Boolean(personURL(url));
  const all = nodes(html), headings = all.filter(n => (profile ? ['h1'] : ['h1','h2','h3']).includes(n.tagName));
  const rows = all.filter(n => n.tagName === 'tr').map(n => ({ label: text(n.childNodes?.find(c => ['td','th'].includes(c.tagName)) ?? {}), node: n }));
  const directors = rows.filter(r => r.label === 'Режисер:').slice(0,16).map(r => ({ text: text(r.node).slice(0, 700), links: r.node.childNodes.flatMap(function walk(n) { return n.tagName === 'a' ? [{ text: text(n).slice(0,500), title: attr(n,'title')?.slice(0,500) ?? null, href: attr(n,'href')?.match(/^\/persons\/[a-z0-9-]+$/)?.[0]?.slice(0,512) ?? null }] : (n.childNodes ?? []).flatMap(walk); }).slice(0,16) }));
  const main = all.find(n => n.tagName === 'h1');
  return { sourceURL: url, headings: headings.slice(0, 16).map(n => ({ tag: n.tagName, text: text(n).slice(0, 500), attributes: (n.attrs ?? []).filter(a => ['lang','class','data-copy-title'].includes(a.name)).map(a=>({name:a.name,value:a.value.slice(0,500)})) })),
    canonical: all.filter(n => n.tagName === 'link' && attr(n,'rel') === 'canonical').map(n => attr(n,'href')).filter(u => u === url), directors,
    // Never use the H1 parent: it can be BODY and include an entire biography.
    profileHeading: profile && main ? text(main).slice(0,500) : null,
    personLinks: all.filter(n => n.tagName === 'a' && /^https:\/\/(?:www\.)?(?:imdb\.com\/name\/nm\d+|themoviedb\.org\/person\/\d+)(?:[/-][a-z0-9-]*)?\/?$/i.test(attr(n,'href') ?? '')).slice(0, 8).map(n => ({ href: attr(n,'href'), label: text(n).slice(0, 200) })),
  };
}
async function readHTML(url, send, signal) {
  const r = await send(url, { method:'GET', redirect:'manual', credentials:'omit', headers:{Accept:'text/html'}, signal });
  if (!r.ok || !/^text\/html(?:\s*;|$)/i.test(r.headers.get('content-type') ?? '') || !r.body) { void r.body?.cancel().catch(()=>{}); return { status:r.status >= 300 && r.status < 400 ? 'redirect-refused' : 'http-or-content-error', httpStatus:r.status }; }
  const chunks = []; let size = 0;
  for await (const part of r.body) { size += part.length; if (size > 8*1024*1024) { void r.body.cancel().catch(()=>{}); return { status:'local-inspection-size-limit', bytes:size }; } chunks.push(part); }
  return { status:'ok', httpStatus:r.status, bytes:size, html:new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,size)) };
}

export async function practicalOperation({ tmdbToken, tavilyKey, operation, context = {} }, fetchImpl = fetch) {
  context ??= {};
  const counts = { tmdb:0, search:0, cards:0, personPages:0, total:0 }, attempts = [];
  const result = { execution:'local-diagnostic', buildSha:null, runId:randomUUID(), startedAt:new Date().toISOString(), action:operation?.action, counts, attempts };
  const done = (status, extra = {}) => ({ result:{ ...result, status, ...extra }, context });
  const allowed = ['identify','resolve','inspect-card','inspect-person','status'];
  if (!operation || !allowed.includes(operation.action) || Object.keys(operation).some(k => !['action','film','url'].includes(k))) return done('invalid-operation');
  if (operation.action === 'status') return done('ready', { cachedFilms:Object.keys(context.films ?? {}).map(Number) });
  const index = operation.film - 1, control = practicalFilms[index];
  if (!control || !Number.isInteger(operation.film) || [tmdbToken,tavilyKey].some(s => typeof s !== 'string' || !s || s.length > 4096 || /\s/.test(s))) return done('invalid-local-input');
  if (operation.action.startsWith('inspect-') && !(operation.action === 'inspect-card' ? admitKinobazaURL(operation.url) : personURL(operation.url))) return done('unadmitted-inspection-url');
  result.film = `${control.title} (${control.year})`;
  // This is a task-wide series, not unlimited per-request runtime work. Each
  // invocation is bounded and actual resolver still enforces 2 search/2 cards.
  const signal = AbortSignal.timeout(60_000);
  let queryURL, detailURL;
  const send = async (url, init) => {
    const type = url === queryURL || url === detailURL ? 'tmdb' : url === 'https://api.tavily.com/search' || isKinobazaSearchURL(url) ? 'search' : admitKinobazaURL(url) ? 'cards' : operation.action === 'inspect-person' && url === operation.url && personURL(url) ? 'personPages' : null;
    if (!type || signal.aborted || init.redirect !== 'manual' || init.credentials !== 'omit' || init.method !== (url === 'https://api.tavily.com/search' ? 'POST' : 'GET') || counts.total >= 6 || counts[type] >= 2 || (type === 'personPages' || isKinobazaSearchURL(url)) && Object.keys(init.headers ?? {}).some(k => /authorization|cookie|key/i.test(k))) throw Error('local-source-boundary');
    counts[type]++; counts.total++;
    const attempt = { type, outcome:'dispatched' }; attempts.push(attempt);
    try { const r = await fetchImpl(url, { ...init, signal:AbortSignal.any([signal,init.signal].filter(Boolean)) }); attempt.httpStatus = r.status; attempt.outcome = 'response-received'; return r; }
    catch { attempt.outcome = 'transport-outcome-unknown'; throw Error('local-transport'); }
  };
  try {
    context.films ??= {};
    let film = context.films[operation.film];
    if (!film) {
      queryURL = `${api}/search/movie?query=${encodeURIComponent(control.title)}&language=uk-UA&include_adult=false&page=1&year=${control.year}`;
      const search = await readTmdbJson(queryURL, tmdbToken, send, {signal});
      if (search.status !== 'ok') return done(`tmdb-search-${search.status}`);
      const found = search.data?.results?.filter(c => Number.isSafeInteger(c.id) && c.id > 0 && normalize(c.original_title) === normalize(control.title) && c.release_date?.slice(0,4) === String(control.year));
      if (found?.length !== 1) return done('tmdb-search-identity-not-unique');
      detailURL = `${api}/movie/${found[0].id}?language=uk-UA&append_to_response=${append}`;
      const detail = await readTmdbJson(detailURL, tmdbToken, send, {signal});
      if (detail.status !== 'ok' || !/^tt\d{7,10}$/.test(detail.data?.imdb_id ?? '')) return done('tmdb-details-unresolved');
      const p = projectTmdbIdentityFor(detail.data, {tmdbId:found[0].id, imdbId:detail.data.imdb_id});
      if (p.identity.status !== 'matched' || normalize(val(p.metadata.originalTitle)) !== normalize(control.title) || val(p.metadata.releaseDate)?.slice(0,4) !== String(control.year)) return done('tmdb-details-identity-refused');
      const directors = p.metadata.directors.items ?? [];
      film = { id:`imdb:${detail.data.imdb_id}`,tmdbId:found[0].id,imdbId:detail.data.imdb_id,identityTitle:val(p.metadata.requestedTitle),originalTitle:val(p.metadata.originalTitle),year:control.year,
        directorCount:p.metadata.directors.state === 'reported' ? directors.length : null, directorPeople:projectDirectorPeople(p.metadata.directors),
        directorAliases:directors.flatMap(d=>[val(d.name),val(d.originalName)]).filter(Boolean),titleAliases:[val(p.metadata.requestedTitle),val(p.metadata.originalTitle),...(p.metadata.alternativeTitles.items ?? []).map(a=>val(a.title))].filter(Boolean) };
      context.films[operation.film] = film;
    }
    result.identity = film;
    if (operation.action === 'identify') return done('identity-established');
    if (operation.action === 'inspect-person') {
      const page = await readHTML(operation.url, send, signal);
      return done(page.status, { bytes:page.bytes, publicIdentity:page.html ? inspectPublicIdentity(page.html,operation.url) : null });
    }
    const comparisons = [];
    const onIdentityDiagnostic = d => comparisons.push({sourceURL:d.sourceURL,status:d.status,reason:d.reason,source:d.sourceIdentity,expected:d.expected,diagnostics:d.diagnostics});
    if (operation.action === 'inspect-card') {
      let inspection;
      const fetchCard = async (url, init) => {
        const r = await send(url,init);
        if(r.ok && r.body && Number(r.headers.get('content-length')) <= 2*1024*1024) {
          const clone = r.clone(), reader = clone.body.getReader(), chunks = []; let bytes = 0;
          for (;;) { const part = await reader.read(); if(part.done) { inspection = inspectPublicIdentity(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,bytes)),url); break; }
            bytes += part.value.byteLength; if(bytes > 2*1024*1024) { void reader.cancel().catch(()=>{}); break; } chunks.push(part.value); }
        }
        return r;
      };
      const card = await fetchAssistedKinobaza(operation.url, film, fetchCard, {signal,onIdentityDiagnostic});
      return done(card.identity?.status ?? card.status, { comparisons, publicIdentity:inspection, extraction:card.status, candidateCount:card.candidates?.length ?? 0, localizationBlocks:card.localization?.blocks?.length ?? 0 });
    }
    const stages = new Set(), searchPointers = [];
    const searchFactory = (key, sendSearch) => tavilySearch(key, sendSearch, { onCandidateURLs: urls => searchPointers.push(urls.map(url => describeCandidateURL(url, {secrets:[tmdbToken,tavilyKey]}))) });
    const publicSearchFactory = sendSearch => kinobazaPublicSearch(sendSearch, {secrets:[tmdbToken,tavilyKey],onCandidateURLs:urls=>searchPointers.push(urls.map(url=>describeCandidateURL(url,{secrets:[tmdbToken,tavilyKey]})))});
    const resolved = await createKinobazaResolver({ apiKey:tavilyKey,onIdentityDiagnostic,searchFactory,publicSearchFactory })(film, { fetchImpl:send, signal, calls:[], reserve:async stage => { if(stages.has(stage)) throw Error('repeat-reservation'); stages.add(stage); } });
    return done(resolved.status, { resolver:resolved.resolver, comparisons, searchPointers,
      confirmed: [resolved.result, ...(resolved.choices ?? [])].filter(Boolean).map(c => ({ sourceURL:c.sourceURL, identity:c.identity?.status, reason:c.identity?.reason, extraction:c.status, candidates:c.candidates?.length ?? 0, providerBlocks:c.localization?.blocks?.length ?? 0 })) });
  } catch { return done(signal.aborted ? 'local-deadline-no-retry' : 'local-operation-failed-no-retry'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input;
  try {
    if (!process.argv.includes('--session-worker')) throw Error('explicit-local-worker-required');
    let size = 0; const chunks = [];
    for await (const chunk of process.stdin) { size += chunk.length; if(size > 256*1024) throw Error(); chunks.push(chunk); }
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const out = await practicalOperation(input);
    const safe = JSON.stringify(out);
    if ([input.tmdbToken,input.tavilyKey].filter(Boolean).some(key=>safe.includes(key))) throw Error('secret-output-refused');
    process.stdout.write(safe+'\n');
  } catch { process.stdout.write('{"result":{"execution":"local-diagnostic","status":"local-worker-failed-no-retry"},"context":{}}\n'); process.exitCode=2; }
  finally { if(input){input.tmdbToken=null;input.tavilyKey=null;} }
}
