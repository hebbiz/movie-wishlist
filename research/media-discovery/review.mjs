// Local human-review pass over an authorized live run; never calls any API.
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { normalize } from './evidence.mjs';
import { redact } from './gemini.mjs';
import { renderReport } from './cli.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const options = {};
const json = value => JSON.stringify(redact(value, [process.env.GEMINI_API_KEY, process.env.TMDB_API_KEY]), null, 2) + '\n';
try {
  for (let i = 2; i < process.argv.length; i += 2) {
    if (!['--run', '--reviews'].includes(process.argv[i]) || !process.argv[i + 1]) throw new Error('Use --run <run-directory> --reviews <review-json>');
    options[process.argv[i].slice(2)] = process.argv[i + 1];
  }
  if (!options.run || !options.reviews) throw new Error('Use --run <run-directory> --reviews <review-json>');
  if (!process.env.GEMINI_GROUNDING_PERMISSION_REF) throw new Error('Missing GEMINI_GROUNDING_PERMISSION_REF; resolve research/storage/analysis rights first');
  const base = await realpath(join(root, 'runs'));
  const input = await realpath(resolve(options.run));
  const within = relative(base, input);
  if (!within || within.startsWith('..') || isAbsolute(within)) throw new Error('Input must be a run folder inside this PoC runs/');
  const manifest = JSON.parse(await readFile(join(input, 'manifest.json'), 'utf8'));
  if (manifest.mode !== 'live' || manifest.liveGate) throw new Error('Review input must be an authorized live run');
  const reviewsText = await readFile(resolve(options.reviews), 'utf8');
  const reviews = JSON.parse(reviewsText);
  if (!Array.isArray(reviews)) throw new Error('Reviews must be a JSON array');
  const output = join(base, `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}-review`);
  await mkdir(output);
  const start = performance.now();
  const records = [];
  for (const id of manifest.selected) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Invalid fixture id in manifest');
    const before = performance.now();
    const originalText = await readFile(join(input, `${id}.normalized.json`), 'utf8');
    const original = JSON.parse(originalText);
    if (original.mode !== 'live' || original.movie?.id !== id) throw new Error('Input is not a matching live normalized result');
    let attempt;
    for (const number of [2, 1]) {
      try {
        const item = JSON.parse(await readFile(join(input, `${id}.raw-attempt-${number}.json`), 'utf8'));
        if (item.status === 200) { attempt = item; break; }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (!attempt) throw new Error('No successful raw response in input run');
    if (attempt.raw?.synthetic) throw new Error('Synthetic data cannot become live human validation');
    const normalized = normalize(attempt.raw, original.movie, { mode: 'live', reviews,
      retrievedAt: original.retrievedAt, validationAt: new Date().toISOString() });
    normalized.mode = 'review';
    normalized.sourceRun = within;
    normalized.sourceNormalizedSha256 = createHash('sha256').update(originalText).digest('hex');
    await writeFile(join(output, `${id}.normalized.json`), json(normalized), { flag: 'wx' });
    records.push({ movie: id, status: 'reviewed', metrics: normalized.metrics,
      elapsedMs: performance.now() - before, applicationCalls: 0, httpAttempts: 0,
      note: 'No new usage/cost; see original run metrics for all API attempts.' });
  }
  await writeFile(join(output, 'metrics.jsonl'), records.map(r => JSON.stringify(r)).join('\n') + '\n', { flag: 'wx' });
  await writeFile(join(output, 'summary.json'), json({ mode: 'review', sourceRun: within,
    permissionReference: process.env.GEMINI_GROUNDING_PERMISSION_REF,
    reviewsSha256: createHash('sha256').update(reviewsText).digest('hex'),
    totalElapsedMs: performance.now() - start, applicationCalls: 0, httpAttempts: 0, records }), { flag: 'wx' });
  await writeFile(join(output, 'report.md'), renderReport(records, 'review'), { flag: 'wx' });
  console.log(JSON.stringify({ output, applicationCalls: 0, humanConfirmedClaims: records.reduce((n, r) => n + r.metrics.confirmedClaimsHumanVerified, 0) }));
} catch (error) {
  console.error(redact(error.message, [process.env.GEMINI_API_KEY, process.env.TMDB_API_KEY]));
  process.exitCode = 1;
}
