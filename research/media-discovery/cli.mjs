import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { PROMPT_VERSION, RESPONSE_SCHEMA, STORES } from './config.mjs';
import { normalize } from './evidence.mjs';
import { costEstimate, groundedSearch, redact, requestBody } from './gemini.mjs';
import { syntheticResponse } from './fixtures/synthetic.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const json = value => JSON.stringify(value, null, 2) + '\n';
const digest = value => createHash('sha256').update(value).digest('hex');
export const movies = JSON.parse(await readFile(join(ROOT, 'fixtures/movies.json'), 'utf8'));

export function argumentsFor(args) {
  const options = { mode: 'dry-run', movie: 'all', verifyTmdb: false };
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--verify-tmdb') { options.verifyTmdb = true; continue; }
    if (!['--mode', '--movie', '--reviews'].includes(key) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Invalid argument: ${key}`);
    options[key.slice(2)] = args[++i];
  }
  if (!['dry-run', 'offline', 'live'].includes(options.mode)) throw new Error('mode: dry-run | offline | live');
  if (options.movie !== 'all' && !movies.some(m => m.id === options.movie)) throw new Error('Unknown movie fixture');
  return options;
}

export async function tmdbIdentity(movie, key, fetchImpl = fetch) {
  const start = performance.now();
  const url = new URL(`https://api.themoviedb.org/3/movie/${movie.tmdbId}`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('append_to_response', 'external_ids,credits');
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) return { status: 'error', httpStatus: response.status, elapsedMs: performance.now() - start, calls: 1 };
  const raw = redact(await response.json(), [key]);
  const directorMatches = raw.credits?.crew?.some(p => p.job === 'Director' && p.name === movie.director);
  return { status: raw.id === movie.tmdbId && raw.external_ids?.imdb_id === movie.imdbId && directorMatches ? 'matched' : 'mismatch',
    calls: 1, elapsedMs: performance.now() - start, raw,
    note: 'Identity only; no Watch Providers lookup. Year alone is not a rejection rule.' };
}

export function renderReport(records, mode) {
  const rows = records.map(r => `| ${r.movie} | ${r.status} | ${r.metrics?.foundListings ?? 'n/a'} | ${r.metrics?.usableOffers ?? 'n/a'} | ${r.metrics?.confirmedClaimsHumanVerified ?? 'n/a'} | ${r.elapsedMs.toFixed(1)} |`);
  return `# Media Discovery run\n\nMode: ${mode}. ${mode === 'offline' ? 'Synthetic fixtures only; no live findings.' : mode === 'dry-run' ? 'No network calls; request preparation only.' : mode === 'review' ? 'Local human review, zero new API calls; original usage remains in the source run.' : 'Live mode requested; check per-film status before interpreting as an executed experiment.'}\n\n| Film | Status | Found listings | Usable offers | Human confirmed claims | Elapsed ms |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\nNo result establishes unavailability. Review metrics.jsonl and each normalized JSON for unknowns, conflicts, checked/unobserved stores and partial cost estimates.\n`;
}

export async function run(options, env = process.env, { search = groundedSearch } = {}) {
  const totalStart = performance.now();
  const selected = options.movie === 'all' ? movies : movies.filter(m => m.id === options.movie);
  const model = env.GEMINI_MODEL || 'gemini-3.8-flash';
  const secrets = [env.GEMINI_API_KEY, env.TMDB_API_KEY];
  const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const output = join(ROOT, 'runs', `${stamp}-${options.mode}`);
  await mkdir(output, { recursive: true });
  const promptTemplate = await readFile(join(ROOT, `prompts/${PROMPT_VERSION}.txt`), 'utf8');
  const reviews = options.reviews ? JSON.parse(await readFile(resolve(options.reviews), 'utf8')) : [];
  if (!Array.isArray(reviews)) throw new Error('Reviews must be a JSON array');
  const records = [];
  const persist = (name, value) => writeFile(join(output, name), json(redact(value, secrets)), { flag: 'wx' });
  const gate = options.mode === 'live' ? !env.GEMINI_API_KEY ? 'missing GEMINI_API_KEY' :
    !env.GEMINI_MODEL ? 'missing GEMINI_MODEL' : !env.GEMINI_GROUNDING_PERMISSION_REF ?
      'missing GEMINI_GROUNDING_PERMISSION_REF: resolve Google Search research/storage/analysis/display rights first' : null : null;
  await persist('manifest.json', { mode: options.mode, selected: selected.map(m => m.id), model,
    transport: search === groundedSearch ? 'gemini-rest' : 'injected-test-transport',
    promptVersion: PROMPT_VERSION, promptSha256: digest(promptTemplate), schemaSha256: digest(json(RESPONSE_SCHEMA)),
    parameters: requestBody('').generationConfig, fixtureSha256: digest(json(movies)),
    permissionReference: env.GEMINI_GROUNDING_PERMISSION_REF || null,
    liveGate: gate, policy: 'One grounded call per film, max two HTTP attempts including one transient retry; stop batch on first invalid/failed response.' });
  let stopped = false;
  for (const movie of selected) {
    const start = performance.now();
    const record = { movie: movie.id, mode: options.mode, model, modelVersion: null,
      status: 'not_run', elapsedMs: 0, stagesMs: {}, applicationCalls: 0, httpAttempts: 0,
      attempts: [], cost: null, metrics: null, tmdb: { status: 'not_requested', calls: 0 } };
    const prompt = promptTemplate + '\n' + json({ film: movie, market: 'UA', stores: STORES });
    const body = requestBody(prompt);
    await persist(`${movie.id}.request.json`, { model, body });
    if (stopped) record.status = 'not_run_after_failed_pilot';
    else if (gate) record.status = `blocked: ${gate}`;
    else {
      try {
        if (options.verifyTmdb && options.mode === 'live') {
          const tmdbStart = performance.now();
          try {
            record.tmdb = env.TMDB_API_KEY ? await tmdbIdentity(movie, env.TMDB_API_KEY) : { status: 'skipped_missing_TMDB_API_KEY', calls: 0 };
          } catch {
            record.tmdb = { status: 'error', calls: 1, elapsedMs: performance.now() - tmdbStart,
              note: 'Optional identity API failed; continuing with sourced fixtures.' };
          }
          await persist(`${movie.id}.tmdb.json`, record.tmdb);
          record.stagesMs.tmdb = record.tmdb.elapsedMs ?? 0;
          if (record.tmdb.status === 'mismatch') throw new Error('TMDb identity mismatch; inspect before Gemini');
        }
        if (options.mode === 'dry-run') record.status = 'prepared_no_network';
        else {
          let raw;
          const searchStart = performance.now();
          if (options.mode === 'offline') {
            raw = syntheticResponse(movie);
            await persist(`${movie.id}.raw-synthetic.json`, raw);
          } else {
            record.applicationCalls = 1;
            const response = await search({ model, key: env.GEMINI_API_KEY, body, secrets,
              saveAttempt: async attempt => {
                record.attempts.push({ attempt: attempt.attempt, status: attempt.status, elapsedMs: attempt.elapsedMs,
                  error: attempt.error || null, cost: costEstimate(attempt.raw, model, 'live') });
                record.httpAttempts++;
                await persist(`${movie.id}.raw-attempt-${attempt.attempt}.json`, attempt);
              } });
            raw = response.raw;
          }
          record.stagesMs.searchOrFixture = performance.now() - searchStart;
          record.modelVersion = raw.modelVersion || null;
          record.cost = costEstimate(raw, model, options.mode);
          const normalizeStart = performance.now();
          const normalized = normalize(raw, movie, { mode: options.mode, reviews });
          await persist(`${movie.id}.normalized.json`, normalized);
          record.stagesMs.normalization = performance.now() - normalizeStart;
          record.metrics = normalized.metrics;
          record.status = 'ok';
          // Successful parsing without any Search grounding is not a successful live pilot.
          if (options.mode === 'live' && !normalized.grounding.chunks.length) throw new Error('No Search grounding returned; stop pilot');
        }
      } catch (error) {
        record.status = 'error';
        record.error = redact(error.message, secrets);
        stopped = true;
      }
    }
    record.elapsedMs = performance.now() - start;
    records.push(record);
    await appendFile(join(output, 'metrics.jsonl'), JSON.stringify(redact(record, secrets)) + '\n');
  }
  await writeFile(join(output, 'report.md'), renderReport(records, options.mode), { flag: 'wx' });
  await persist('summary.json', { mode: options.mode, totalElapsedMs: performance.now() - totalStart,
    applicationCalls: records.reduce((sum, r) => sum + r.applicationCalls, 0),
    httpAttempts: records.reduce((sum, r) => sum + r.httpAttempts, 0),
    tmdbCalls: records.reduce((sum, r) => sum + r.tmdb.calls, 0),
    blocked: Boolean(gate), failed: stopped, results: records });
  console.log(json({ output, mode: options.mode, results: records.map(r => ({ movie: r.movie, status: r.status, metrics: r.metrics })) }));
  return { output, records, blocked: Boolean(gate), failed: stopped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await run(argumentsFor(process.argv.slice(2)));
    if (result.failed || result.blocked) process.exitCode = 1;
  } catch (error) {
    // Avoid outputting arbitrary API errors or credentials.
    console.error(redact(error.message, [process.env.GEMINI_API_KEY, process.env.TMDB_API_KEY]));
    process.exitCode = 1;
  }
}
