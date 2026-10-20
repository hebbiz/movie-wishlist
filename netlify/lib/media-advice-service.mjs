import { readTmdbJson, projectTmdbIdentityFor, projectTmdbProvidersFor } from '../../research/grounded-answer-demo/tmdb.mjs';
import { fetchMotnFor } from '../../research/grounded-answer-demo/motn.mjs';
import { composeDiscovery } from '../../research/grounded-answer-demo/discovery.mjs';
const api = 'https://api.themoviedb.org/3';
const append = 'external_ids,alternative_titles,credits,release_dates,translations';
const val = f => f?.state === 'reported' ? f.value : null;
const title = s => typeof s === 'string' && s.length <= 500 && !/[\p{C}]/u.test(s) ? s : null;

// A single server request, no process-local session Map or shared chat state.
export async function discoverMedia({ imdbId, tmdbToken, motnKey, reserve, fetchImpl = fetch, resolver, signal }) {
  const calls = [];
  const once = (stage, target) => async (url, init) => {
    if (url !== target || init.method !== 'GET' || init.redirect !== 'manual' || calls.some(c => c.stage === stage)) throw Error('request-boundary');
    if (signal?.aborted) throw Error('deadline');
    await reserve(stage); // Durable reservation commits before I/O, including errors.
    const call = { stage, status: 'attempt-reserved' }; calls.push(call);
    try { if (signal?.aborted) throw Error('deadline'); const response = await fetchImpl(url, { ...init, signal: signal ? AbortSignal.any([signal, init.signal].filter(Boolean)) : init.signal }); call.httpStatus = response.status; call.status = 'response-received'; return response; }
    catch { call.status = 'transport-outcome-unknown'; throw Error('transport-failed'); }
  };
  const read = async (stage, url) => tmdbToken ? readTmdbJson(url, tmdbToken, once(stage, url), { signal }) : { status: 'missing-token-no-request' };
  const findURL = `${api}/find/${imdbId}?external_source=imdb_id&language=uk-UA`;
  const found = await read('tmdb-find', findURL);
  const candidates = found.data?.movie_results;
  const selected = Array.isArray(candidates) && candidates.length === 1 && Number.isSafeInteger(candidates[0]?.id) && candidates[0].id > 0 ? candidates[0] : null;
  // find-by-IMDb is a crosswalk assertion, not an arbitrary first search result.
  // Independent MOTN can still respond if TMDb transport/availability fails.
  const film = { id: `imdb:${imdbId}`, imdbId, tmdbId: selected?.id ?? null, title: title(selected?.title) ?? imdbId, identityTitle: title(selected?.title), originalTitle: title(selected?.original_title), year: null, directorAliases: [], directorCount: null, titleAliases: [] };
  let projection = null, detailsStatus = found.status;
  if (selected) {
    const details = await read('tmdb-details', `${api}/movie/${selected.id}?language=uk-UA&append_to_response=${append}`);
    projection = details.status === 'ok' ? projectTmdbIdentityFor(details.data, { tmdbId: selected.id, imdbId }) : null;
    detailsStatus = projection?.status ?? details.status;
    if (projection?.identity?.status === 'matched') {
      film.identityTitle = title(val(projection.metadata.requestedTitle)); film.originalTitle = title(val(projection.metadata.originalTitle));
      film.title = film.identityTitle ?? film.originalTitle ?? film.title;
      const release = val(projection.metadata.releaseDate); film.year = /^\d{4}-\d{2}-\d{2}$/.test(release ?? '') ? Number(release.slice(0, 4)) : null;
      const directors = projection.metadata.directors.items ?? [];
      film.directorCount = projection.metadata.directors.state === 'reported' ? directors.length : null;
      film.directorAliases = directors.flatMap(d => [title(val(d.name)), title(val(d.originalName))]).filter(Boolean);
      film.titleAliases = [film.identityTitle, film.originalTitle, ...(projection.metadata.alternativeTitles.items ?? []).map(t => title(val(t.title)))].filter(Boolean);
    }
  }
  const providersURL = selected ? `${api}/movie/${selected.id}/watch/providers` : null;
  // MOTN has its own exact IMDb gate. A missing TMDb crosswalk never invents an ID.
  // Its adapter also needs a validated TMDb ID; without /find it is not evaluated.
  const motnURL = selected ? `https://api.movieofthenight.com/v4/shows/${imdbId}?country=ua` : null;
  const [b, motn] = await Promise.all([
    selected ? read('tmdb-providers', providersURL) : { status: 'not-evaluated-crosswalk-unresolved' },
    selected ? fetchMotnFor({ ...film, tmdbId: String(selected.id), title: film.originalTitle ?? film.title, titleAliases: film.titleAliases.length ? film.titleAliases : [film.originalTitle ?? film.title] }, motnKey, once('motn-title', motnURL), { signal }) : { status: 'not-evaluated-crosswalk-unresolved', options: [] },
  ]);
  const providers = b.status === 'ok' ? projectTmdbProvidersFor(b.data, film) : { status: b.status };
  const stages = { tmdb: { status: `A: ${detailsStatus}; B: ${providers.status}`, result: { identity: projection, providers } }, motn: { status: motn.status, result: motn }, kinobaza: { status: 'not-evaluated-resolver-deferred', result: null } };
  if (resolver && projection?.identity?.status === 'matched') stages.kinobaza = await resolver(film, { reserve, fetchImpl, calls, signal });
  const result = composeDiscovery(film, stages, { sourceURLs: { tmdb: providersURL, motn: motnURL }, metrics: { requestsMade: calls.length, requestBudget: resolver ? 8 : 4, calls } });
  // Keep projected unmapped observations rather than lose Plex/MUBI claims.
  for (const row of result.unmapped) {
    if (row.source === 'motn') row.observations = (motn.options ?? []).filter(o => val(o.service.id) === row.id && val(o.service.name) === row.name && (!row.access || JSON.stringify(o.access) === JSON.stringify(row.access)));
    if (row.source === 'tmdb') row.observations = (providers.buckets ?? []).flatMap(b => (b.providers.items ?? []).filter(p => val(p.id) === row.id && val(p.name) === row.name && (!row.access || b.access === row.access)).map(p => ({ provider: p, access: b.access, bucket: b.name })));
    if (row.source === 'motn') row.provenance ??= { source: 'Movie of the Night', receivedAt: motn.receivedAt, method: 'API streamingOptions.ua' };
    if (row.source === 'tmdb') row.provenance ??= { source: 'TMDb / JustWatch', upstream: 'JustWatch', receivedAt: providers.receivedAt, method: 'API results.UA' };
  }
  // No raw response body, source HTML or full projected stage archive crosses the boundary.
  delete result.stages;
  return result;
}
