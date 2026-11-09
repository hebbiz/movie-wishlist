// Opt-in local series worker. Credentials/private context travel only over stdin.
// Not an application endpoint, catalogue, prefilled URL resolver or evidence archive.
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parse } from 'parse5';
import { readTmdbJson, projectTmdbIdentityFor } from '../netlify/lib/media-source-tmdb.mjs';
import { admitKinobazaURL, fetchAssistedKinobaza } from '../netlify/lib/kinobaza-card.mjs';
import { createKinobazaResolver, tavilySearch } from '../netlify/lib/kinobaza-resolver.mjs';
import { describeCandidateURL } from './m4-url-diagnostics.mjs';
import { projectDirectorPeople } from '../shared/director-alias-crosswalk.mjs';
import { composeDiscovery } from '../netlify/lib/media-discovery-compose.mjs';
import { projectFilmIdentityContext } from '../shared/film-identity-context.mjs';
import { admitDirectorProfileURL } from '../netlify/lib/director-profile.mjs';

export const practicalFilms = Object.freeze([
  { title: 'Blade Runner 2049', year: 2017 }, { title: 'Mortal Kombat', year: 2021 },
  { title: 'Alien', year: 1979 }, { title: 'Oppenheimer', year: 2023 }, { title: 'Dune: Part Two', year: 2024 },
]);
// Local task selections only. No IDs, source URLs or application catalogue entry.
export const practicalStudies = Object.freeze({
  'practical-five': practicalFilms,
  'pilot-retrieval': Object.freeze([
    Object.freeze({ title: 'Blade Runner', year: 1982 }),
    Object.freeze({ title: 'Mortal Kombat', year: 2021 }),
    Object.freeze({ title: 'Supergirl', year: 2026 }),
  ]),
  'tavily-fallback': Object.freeze([
    Object.freeze({ title: 'Alien', year: 1979 }),
    Object.freeze({ title: 'Mad Max: Fury Road', year: 2015 }),
    Object.freeze({ title: 'Dune: Part Two', year: 2024 }),
    Object.freeze({ title: 'Blade Runner 2049', year: 2017 }),
    Object.freeze({ title: 'Mortal Kombat', year: 2021 }),
  ]),
  'cascade-identity': Object.freeze([
    Object.freeze({ title: 'Alien', year: 1979 }),
    Object.freeze({ title: 'Mad Max: Fury Road', year: 2015 }),
    Object.freeze({ title: 'Dune: Part Two', year: 2024 }),
    Object.freeze({ title: 'Supergirl', year: 2026 }),
    Object.freeze({ title: 'Goodfellas', year: 1990 }),
    Object.freeze({ title: 'The Pursuit of Happyness', year: 2006 }),
    Object.freeze({ title: 'The Lives of Others', year: 2006 }),
    // The verified selected TMDb projection uses 2008; the source card's 2006
    // nomination remains a separate observed year, never a seeded crosswalk.
    Object.freeze({ title: 'The Fall', year: 2008 }),
    Object.freeze({ title: 'The Prestige', year: 2006 }),
  ]),
  'production-beta': Object.freeze([
    {title:'Alien',year:1979}, {title:'Mad Max: Fury Road',year:2015},
    {title:'Dune: Part Two',year:2024}, {title:'Supergirl',year:2026},
    {title:'Goodfellas',year:1990}, {title:'The Pursuit of Happyness',year:2006},
    {title:'The Lives of Others',year:2006}, {title:'The Fall',year:2008},
    {title:'The Prestige',year:2006}, {title:'A Separation',year:2011},
    {title:'The Handmaiden',year:2016}, {title:'Amélie',year:2001},
  ].map(Object.freeze)),
});
const normalize = s => typeof s === 'string' ? s.normalize('NFC').replace(/\s+/gu, ' ').trim().toLowerCase() : '';
const val = f => f?.state === 'reported' ? f.value : null;
const api = 'https://api.themoviedb.org/3';
const append = 'external_ids,alternative_titles,credits,release_dates,translations';
const attr = (n, key) => n.attrs?.find(a => a.name === key)?.value;
const text = n => (n.childNodes ?? []).map(c => c.nodeName === '#text' ? c.value : ['script','style','template','noscript','iframe'].includes(c.tagName) ? '' : text(c)).join(' ').replace(/\s+/gu, ' ').trim();
const personURL = s => typeof s === 'string' && /^https:\/\/kinobazaua\.com\/persons\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) ? s : null;
const nodes = html => { const out = [], stack = [parse(html, { sourceCodeLocationInfo: true })]; while (stack.length && out.length < 100_000) { const n = stack.pop(); out.push(n); stack.push(...n.childNodes ?? []); } return out; };
const safeName = s => typeof s === 'string' && s.trim() && s.length <= 500 && !/[\p{C}]/u.test(s);
const calendarDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
const issueCodes = values => [...new Set((values ?? []).filter(v => typeof v === 'string' && /^[a-z0-9-]{1,120}$/.test(v)))].slice(0,32);
const localizationField = f => ({ state: f?.state ?? 'unknown', language: f?.language ?? 'uk',
  evidence: (f?.evidence ?? []).slice(0,64).map(e => ({ label:e.label, literal:e.literal, state:e.state,
    ...(e.formatLiteral ? {formatLiteral:e.formatLiteral} : {}), ...(e.typeLiteral ? {typeLiteral:e.typeLiteral} : {}) })) });

// Reuse the application projection, then retain only bounded diagnostic fields.
// Provider destinations, tracking queries and full projected reports never leave.
function summarizeDiscovery(film, card) {
  const projected = composeDiscovery(film, { tmdb:{status:'not-requested',result:null}, motn:{status:'not-requested',result:null}, kinobaza:{status:card.status,result:card} });
  return { mappedCount:projected.rows.length, unmappedCount:projected.unmapped.length,
    filmUkrainianAudio:localizationField(projected.filmLocalization?.ukrainianAudio),
    mapped:projected.rows.slice(0,100).map(r => ({ provider:r.provider.name, providerKey:r.provider.key, country:r.country,
      audio:localizationField(r.kinobazaLocalization?.audio), subtitles:localizationField(r.kinobazaLocalization?.subtitles),
      extraction:r.linkAudit?.extraction, blockAssociation:r.linkAudit?.blockAssociation, linkKind:r.link?.kind,
      issues:issueCodes(r.kinobazaLocalization?.issues) })),
    unmapped:projected.unmapped.slice(0,100).map(r => ({ name:r.name, reason:r.reason, extractionIssue:r.extractionIssue })),
    extractionIssues:issueCodes(card.issues) };
}

// A few public identity fields, never an HTML dump, search response, snippet or offer archive.
export function inspectPublicIdentity(html, url) {
  const profile = Boolean(personURL(url));
  const all = nodes(html), headings = all.filter(n => (profile ? ['h1'] : ['h1','h2','h3']).includes(n.tagName));
  const rows = all.filter(n => n.tagName === 'tr').map(n => ({ label: text(n.childNodes?.find(c => ['td','th'].includes(c.tagName)) ?? {}), node: n }));
  const directors = rows.filter(r => r.label === 'Режисер:').slice(0,16).map(r => ({ text: text(r.node).slice(0, 700), links: r.node.childNodes.flatMap(function walk(n) { return n.tagName === 'a' ? [{ text: text(n).slice(0,500), title: attr(n,'title')?.slice(0,500) ?? null, href: attr(n,'href')?.match(/^\/persons\/[a-z0-9-]+$/)?.[0]?.slice(0,512) ?? null }] : (n.childNodes ?? []).flatMap(walk); }).slice(0,16) }));
  // Observe labelled film-ID rows only. Invalid targets contribute a count, not
  // a raw URL/query/token. This local diagnostic is not an identity decision.
  const filmIds = rows.filter(r => ['IMDb:','TMDb:'].includes(r.label)).slice(0,16).map(r => {
    const cells = (r.node.childNodes ?? []).filter(n => ['td','th'].includes(n.tagName));
    if (cells.length !== 2) return { namespace:r.label === 'IMDb:' ? 'imdb:movie' : 'tmdb:movie', ids:[], malformed:1 };
    const imdb = r.label === 'IMDb:', literalPattern = imdb ? /^tt\d{1,20}$/ : /^\d{1,10}$/;
    const linkPattern = imdb ? /^https:\/\/(?:www\.)?imdb\.com\/title\/(tt\d{1,20})\/?$/ : /^https:\/\/(?:www\.)?themoviedb\.org\/movie\/(\d{1,10})(?:-[a-z0-9-]+)?\/?$/;
    const links = (cells[1].childNodes ?? []).flatMap(function walk(n) { return n.tagName === 'a' ? [n] : (n.childNodes ?? []).flatMap(walk); });
    const ids = [], literal = text(cells[1]); let malformed = Math.max(0,links.length - 20);
    for (const link of links.slice(0,20)) { const id = linkPattern.exec(attr(link,'href') ?? '')?.[1]; if (id) ids.push(id); else malformed++; }
    if (literal && (!links.length || literalPattern.test(literal))) { if (literalPattern.test(literal)) ids.push(literal); else malformed++; }
    return { namespace:imdb ? 'imdb:movie' : 'tmdb:movie', ids:[...new Set(ids)], malformed };
  });
  const main = all.find(n => n.tagName === 'h1');
  return { sourceURL: url, headings: headings.slice(0, 16).map(n => ({ tag: n.tagName, text: text(n).slice(0, 500), attributes: (n.attrs ?? []).filter(a => ['lang','class','data-copy-title'].includes(a.name)).map(a=>({name:a.name,value:a.value.slice(0,500)})) })),
    canonical: all.filter(n => n.tagName === 'link' && attr(n,'rel') === 'canonical').map(n => attr(n,'href')).filter(u => u === url), directors, filmIds,
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

export async function practicalOperation({ tmdbToken, tavilyKey, operation, context = {} }, fetchImpl = fetch, { compareCard } = {}) {
  context ??= {};
  const counts = { tmdb:0, search:0, cards:0, personPages:0, total:0 }, attempts = [];
  const result = { execution:'local-diagnostic', buildSha:null, runId:randomUUID(), startedAt:new Date().toISOString(), action:operation?.action, counts, attempts };
  const started = performance.now();
  const done = (status, extra = {}) => ({ result:{ ...result, elapsedMs:Math.round(performance.now()-started), status, ...extra }, context });
  const allowed = ['identify','resolve','inspect-card','inspect-person','inspect-director','status'];
  if (!operation || !allowed.includes(operation.action) || Object.keys(operation).some(k => !['action','film','url'].includes(k))) return done('invalid-operation');
  const study = context.study ?? 'practical-five';
  if (!Object.hasOwn(practicalStudies, study)) return done('invalid-local-study');
  if (operation.action === 'status') return done('ready', { cachedFilms:Object.keys(context.films ?? {}).map(Number) });
  const index = operation.film - 1, control = practicalStudies[study][index];
  if (!control || !Number.isInteger(operation.film) || [tmdbToken,tavilyKey].some(s => typeof s !== 'string' || !s || s.length > 4096 || /\s/.test(s))) return done('invalid-local-input');
  if (['inspect-card','inspect-person'].includes(operation.action) && !(operation.action === 'inspect-card' ? admitKinobazaURL(operation.url) : personURL(operation.url))) return done('unadmitted-inspection-url');
  if (!['inspect-card','inspect-person'].includes(operation.action) && Object.hasOwn(operation,'url')) return done('invalid-operation');
  result.film = `${control.title} (${control.year})`;
  // This is a task-wide series, not unlimited per-request runtime work. Each
  // invocation is bounded and actual resolver still enforces 2 search/2 cards.
  const signal = AbortSignal.timeout(60_000);
  let queryURL, detailURL, directorURL;
  const send = async (url, init) => {
    const trusted = context.films?.[operation.film]?.directorPeople;
    const runtimePerson = study === 'production-beta' && operation.action === 'resolve' && trusted?.length === 1 && trusted[0].namespace === 'tmdb:person' &&
      url === `${api}/person/${trusted[0].personId}?language=en-US&append_to_response=external_ids`;
    const runtimeProfile = study === 'production-beta' && operation.action === 'resolve' && admitDirectorProfileURL(url);
    const type = url === queryURL || url === detailURL || url === directorURL || runtimePerson ? 'tmdb' : url === 'https://api.tavily.com/search' ? 'search' : admitKinobazaURL(url) ? 'cards' : (runtimeProfile || operation.action === 'inspect-person' && url === operation.url && personURL(url)) ? 'personPages' : null;
    const limit = study === 'production-beta' ? 8 : 6;
    if (!type || signal.aborted || init.redirect !== 'manual' || init.credentials !== 'omit' || init.method !== (url === 'https://api.tavily.com/search' ? 'POST' : 'GET') || counts.total >= limit || counts[type] >= (type === 'tmdb' && study === 'production-beta' ? 3 : type === 'personPages' ? 1 : 2) || type === 'personPages' && Object.keys(init.headers ?? {}).some(k => /authorization|cookie|key/i.test(k))) throw Error('local-source-boundary');
    counts[type]++; counts.total++;
    const attempt = { type, outcome:'dispatched' }; attempts.push(attempt);
    try { const r = await fetchImpl(url, { ...init, signal:AbortSignal.any([signal,init.signal].filter(Boolean)) }); attempt.httpStatus = r.status; attempt.outcome = 'response-received'; return r; }
    catch { attempt.outcome = 'transport-outcome-unknown'; throw Error('local-transport'); }
  };
  try {
    context.films ??= {};
    let film = context.films[operation.film];
    if (operation.action === 'inspect-director') {
      const person = film?.directorPeople?.[0];
      if (!film || film.directorCount !== 1 || film.directorPeople?.length !== 1 || person?.namespace !== 'tmdb:person' || !Number.isSafeInteger(person.personId) || person.personId < 1) return done('cached-single-director-required');
      directorURL = `${api}/person/${person.personId}?language=uk-UA&append_to_response=external_ids`;
      const response = await readTmdbJson(directorURL, tmdbToken, send, {signal});
      if (response.status !== 'ok') return done(`tmdb-person-${response.status}`);
      const data = response.data, externalIds = data?.external_ids;
      const invalidExternalIds = externalIds !== undefined && externalIds !== null &&
        (typeof externalIds !== 'object' || Array.isArray(externalIds) || externalIds.success === false || Object.hasOwn(externalIds,'status_code') || Object.hasOwn(externalIds,'id') && externalIds.id !== person.personId);
      const imdbIds = [data?.imdb_id,externalIds?.imdb_id].filter(v => v !== undefined && v !== null && v !== '');
      if (data?.id !== person.personId || data.success === false || Object.hasOwn(data,'status_code') || invalidExternalIds || !safeName(data.name) || !Array.isArray(data.also_known_as) || data.also_known_as.length > 32 || !data.also_known_as.every(safeName) ||
          (data.birthday !== undefined && data.birthday !== null && !calendarDate(data.birthday)) || imdbIds.some(v => typeof v !== 'string' || !/^nm\d{7,10}$/.test(v)) || new Set(imdbIds).size > 1) return done('tmdb-person-identity-refused');
      let profileDiscovery;
      if (study === 'production-beta') {
        const pointers = [];
        const response = await tavilySearch(tavilyKey,send,{onCandidateURLs:urls=>pointers.push(...urls.filter(admitDirectorProfileURL))})
          .search('"' + data.name.replace(/["\\]/g,' ') + '" site:kinobazaua.com/persons/',{signal});
        profileDiscovery = {providerStatus:response.status,profileCandidates:[...new Set(pointers)],
          cardOrPersonGET:0,proof:'URL-discovery-only-not-person-identity',searchDiagnostic:response.diagnostics};
      }
      return done('director-identity-inspected', { directorIdentity:{ personId:data.id, name:data.name, alsoKnownAs:data.also_known_as, dateOfBirth:data.birthday ?? null, imdbNameId:imdbIds[0] ?? null },...(profileDiscovery ? {profileDiscovery} : {}) });
    }
    if (!film) {
      const contextual = ['cascade-identity','production-beta'].includes(study);
      const searchLanguage = contextual ? 'en-US' : 'uk-UA';
      queryURL = `${api}/search/movie?query=${encodeURIComponent(control.title)}&language=${searchLanguage}&include_adult=false&page=1&year=${control.year}`;
      const search = await readTmdbJson(queryURL, tmdbToken, send, {signal});
      if (search.status !== 'ok') return done(`tmdb-search-${search.status}`);
      const found = search.data?.results?.filter(c => Number.isSafeInteger(c.id) && c.id > 0 &&
        (normalize(c.original_title) === normalize(control.title) || contextual && normalize(c.title) === normalize(control.title)) &&
        c.release_date?.slice(0,4) === String(control.year) && (!contextual || safeName(c.original_title)));
      if (found?.length !== 1) return done('tmdb-search-identity-not-unique');
      detailURL = `${api}/movie/${found[0].id}?language=uk-UA&append_to_response=${append}`;
      const detail = await readTmdbJson(detailURL, tmdbToken, send, {signal});
      if (detail.status !== 'ok' || !/^tt\d{7,10}$/.test(detail.data?.imdb_id ?? '')) return done('tmdb-details-unresolved');
      const p = projectTmdbIdentityFor(detail.data, {tmdbId:found[0].id, imdbId:detail.data.imdb_id});
      const expectedOriginal = contextual ? found[0].original_title : control.title;
      if (p.identity.status !== 'matched' || normalize(val(p.metadata.originalTitle)) !== normalize(expectedOriginal) || val(p.metadata.releaseDate)?.slice(0,4) !== String(control.year)) return done('tmdb-details-identity-refused');
      const directors = p.metadata.directors.items ?? [];
      film = { id:`imdb:${detail.data.imdb_id}`,tmdbId:found[0].id,imdbId:detail.data.imdb_id,identityTitle:val(p.metadata.requestedTitle),originalTitle:val(p.metadata.originalTitle),year:control.year,
        directorCount:p.metadata.directors.state === 'reported' ? directors.length : null, directorPeople:projectDirectorPeople(p.metadata.directors),
        directorAliases:directors.flatMap(d=>[val(d.name),val(d.originalName)]).filter(Boolean),titleAliases:[val(p.metadata.requestedTitle),val(p.metadata.originalTitle),
          // Only this study's unique exact English search match establishes the
          // control spelling; never invent it from the unrelated original name.
          ...(contextual ? [control.title] : []),...(p.metadata.alternativeTitles.items ?? []).map(a=>val(a.title))].filter(Boolean),
        ...(study === 'production-beta' ? {identityContext:projectFilmIdentityContext(p)} : {}) };
      context.films[operation.film] = film;
    }
    result.identity = film;
    if (study === 'production-beta') film.titleAliases = [...new Set([...film.titleAliases,...film.identityContext.titleEvidence.map(e=>e.title)])];
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
      return done(card.identity?.status ?? card.status, { comparisons, publicIdentity:inspection, extraction:card.status, candidateCount:card.candidates?.length ?? 0, localizationBlocks:card.localization?.blocks?.length ?? 0, discovery:summarizeDiscovery(film,card) });
    }
    const stages = new Set(), searchPointers = [], cardComparisons = [];
    const observedFetch = async (url, init) => {
      const response = await send(url, init);
      // Local opt-in only. No second HTTP call, HTML file or response archive;
      // compare the fixed old identity policy with the new one on these bytes.
      if (['cascade-identity','production-beta'].includes(study) && typeof compareCard === 'function' && admitKinobazaURL(url) &&
          response.ok && /^text\/html\b/i.test(response.headers.get('content-type') ?? '') && response.body) {
        const reader = response.clone().body.getReader(), chunks = []; let bytes = 0;
        try {
          for (;;) {
            const part = await reader.read();
            if (part.done) {
              const html = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes));
              cardComparisons.push({ ...(await compareCard(html, film, url)), publicIdentity: inspectPublicIdentity(html, url) });
              break;
            }
            bytes += part.value.byteLength;
            if (bytes > 2 * 1024 * 1024) { void reader.cancel().catch(() => {}); cardComparisons.push({ sourceURL: url, status: 'comparison-size-bounded' }); break; }
            chunks.push(part.value);
          }
        } catch { void reader.cancel().catch(() => {}); cardComparisons.push({ sourceURL: url, status: 'comparison-unavailable-no-retry' }); }
      }
      return response;
    };
    const searchFactory = (key, sendSearch) => tavilySearch(key, sendSearch, { onCandidateURLs: urls => searchPointers.push(urls.map(url => describeCandidateURL(url, {secrets:[tmdbToken,tavilyKey]}))) });
    const resolved = await createKinobazaResolver({ apiKey:tavilyKey,onIdentityDiagnostic,searchFactory })(film, { fetchImpl:observedFetch, signal, calls:[],
      ...(study === 'production-beta' ? {tmdbToken,sourceCap:10} : {}), reserve:async stage => { if(stages.has(stage)) throw Error('repeat-reservation'); stages.add(stage); } });
    const confirmed = [resolved.result, ...(resolved.choices ?? [])].filter(Boolean).map(c => ({ sourceURL:c.sourceURL, identity:c.identity?.status, reason:c.identity?.reason, extraction:c.status, candidates:c.candidates?.length ?? 0, providerBlocks:c.localization?.blocks?.length ?? 0, discovery:summarizeDiscovery(film,c) }));
    return done(resolved.status, { resolver:resolved.resolver, comparisons, searchPointers, confirmed, ...(['cascade-identity','production-beta'].includes(study) ? { cardComparisons } : {}),
      discovery:{mappedCount:confirmed.reduce((n,c)=>n+c.discovery.mappedCount,0),unmappedCount:confirmed.reduce((n,c)=>n+c.discovery.unmappedCount,0)} });
  } catch { return done(signal.aborted ? 'local-deadline-no-retry' : 'local-operation-failed-no-retry'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input;
  try {
    if (!process.argv.includes('--session-worker')) throw Error('explicit-local-worker-required');
    let size = 0; const chunks = [];
    for await (const chunk of process.stdin) { size += chunk.length; if(size > 256*1024) throw Error(); chunks.push(chunk); }
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    let comparison;
    if (['cascade-identity','production-beta'].includes(input.context?.study) && input.operation?.action === 'resolve') {
      const { loadCascadeBaseline, compareCascadeCard } = await import('./m4-cascade-comparison.mjs');
      const beforeIdentity = await loadCascadeBaseline(input.context.study === 'production-beta' ? '21d1be24acf2b654254c38c9b252246ed8de1343' : undefined);
      comparison = (html, film, url) => compareCascadeCard(html, film, url, beforeIdentity);
    }
    const out = await practicalOperation(input, fetch, { compareCard: comparison });
    const safe = JSON.stringify(out);
    if ([input.tmdbToken,input.tavilyKey].filter(Boolean).some(key=>safe.includes(key))) throw Error('secret-output-refused');
    process.stdout.write(safe+'\n');
  } catch { process.stdout.write('{"result":{"execution":"local-diagnostic","status":"local-worker-failed-no-retry"},"context":{}}\n'); process.exitCode=2; }
  finally { if(input){input.tmdbToken=null;input.tavilyKey=null;} }
}
