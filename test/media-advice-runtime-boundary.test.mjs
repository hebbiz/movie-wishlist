// Offline lexical dependency audit. It reads code and local assets, never
// imports application modules or contacts a source. This deliberately supports
// the repository's JavaScript (not arbitrary TypeScript/JSX): literal ESM
// imports/re-exports, literal import() and require(), plus nested template
// expressions. Unknown import expressions fail closed instead of disappearing
// from the graph. A tokenizer keeps comments, strings and regex bodies inert.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { parse } from 'parse5';
import { execFileSync } from 'node:child_process';
import { MEDIA_ADVICE_BASELINE_SHA } from './media-advice-history.fixture.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RUNTIME_FILES = [
  'netlify/lib/media-source-tmdb.mjs', 'netlify/lib/media-source-motn.mjs',
  'netlify/lib/media-discovery-compose.mjs', 'netlify/lib/kinobaza-card.mjs',
  'netlify/lib/kinobaza-html.mjs', 'netlify/lib/kinobaza-localization.mjs',
];
const localRead = file => readFile(path.join(ROOT, file), 'utf8');
const wordStart = c => c !== undefined && /[A-Za-z_$\p{L}]/u.test(c);
const wordPart = c => c !== undefined && /[A-Za-z\d_$\p{L}\p{N}]/u.test(c);

function tokens(source) {
  const escaped = at => {
    const c = source[at];
    if (c === undefined) throw Error('unterminated-string-escape');
    if (c === '\r' || c === '\n') return { value: '', end: at + (c === '\r' && source[at + 1] === '\n' ? 2 : 1) };
    const simple = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v' };
    if (Object.hasOwn(simple, c)) return { value: simple[c], end: at + 1 };
    if (c === 'x' || c === 'u') {
      const braced = c === 'u' && source[at + 1] === '{';
      const end = braced ? source.indexOf('}', at + 2) : at + (c === 'x' ? 3 : 5);
      const digits = source.slice(at + (braced ? 2 : 1), end);
      if (end < 0 || !/^[\da-f]+$/i.test(digits) || !braced && digits.length !== (c === 'x' ? 2 : 4)) throw Error('unsupported-string-escape');
      const codePoint = Number.parseInt(digits, 16);
      if (codePoint > 0x10ffff) throw Error('invalid-string-codepoint');
      return { value: String.fromCodePoint(codePoint), end: end + Number(braced) };
    }
    if (/\d/.test(c)) {
      if (c !== '0' || /\d/.test(source[at + 1] ?? '')) throw Error('unsupported-legacy-string-escape');
      return { value: '\0', end: at + 1 };
    }
    return { value: c, end: at + 1 };
  };
  const mayEndExpression = previous => previous && (
    ['string', 'template', 'number', 'regexp'].includes(previous.kind) ||
    previous.kind === 'word' && !['return', 'throw', 'case', 'delete', 'typeof', 'void', 'new', 'in', 'of', 'yield', 'await', 'else', 'do', 'instanceof'].includes(previous.value) ||
    [')', ']', '}', '++', '--'].includes(previous.value)
  );
  const scan = (start, interpolation = false) => {
    const result = []; let at = start, braces = 0;
    while (at < source.length) {
      const c = source[at], next = source[at + 1];
      if (/\s/.test(c)) { at++; continue; }
      if (c === '/' && next === '/') { at = source.indexOf('\n', at + 2); if (at < 0) at = source.length; continue; }
      if (c === '/' && next === '*') { const end = source.indexOf('*/', at + 2); if (end < 0) throw Error('unterminated-comment'); at = end + 2; continue; }
      if (c === '"' || c === "'") {
        const quote = c; let value = ''; at++;
        while (at < source.length && source[at] !== quote) {
          if (source[at] === '\\') { const part = escaped(at + 1); value += part.value; at = part.end; }
          else { if (/[\r\n]/.test(source[at])) throw Error('unterminated-string'); value += source[at++]; }
        }
        if (source[at] !== quote) throw Error('unterminated-string');
        at++; result.push({ kind: 'string', value }); continue;
      }
      if (c === '`') {
        let value = ''; const embedded = []; at++;
        while (at < source.length && source[at] !== '`') {
          if (source[at] === '\\') { const part = escaped(at + 1); value += part.value; at = part.end; }
          else if (source[at] === '$' && source[at + 1] === '{') {
            const part = scan(at + 2, true); embedded.push(part.result); at = part.end;
          } else value += source[at++];
        }
        if (source[at] !== '`') throw Error('unterminated-template');
        at++; result.push({ kind: embedded.length ? 'template' : 'string', value, embedded }); continue;
      }
      if (c === '/' && !mayEndExpression(result.at(-1))) {
        let inClass = false; at++;
        while (at < source.length) {
          if (source[at] === '\\') { at += 2; continue; }
          if (/[\r\n]/.test(source[at])) throw Error('unterminated-regexp');
          if (source[at] === '[') inClass = true;
          if (source[at] === ']') inClass = false;
          if (source[at] === '/' && !inClass) break;
          at++;
        }
        if (source[at] !== '/') throw Error('unterminated-regexp');
        at++; while (/[a-z]/i.test(source[at] ?? '') && at < source.length) at++;
        result.push({ kind: 'regexp' }); continue;
      }
      if (wordStart(c)) {
        const begin = at++; while (wordPart(source[at])) at++;
        result.push({ kind: 'word', value: source.slice(begin, at) }); continue;
      }
      if (/\d/.test(c)) {
        const begin = at++; while (/[\w.]/.test(source[at] ?? '') && at < source.length) at++;
        result.push({ kind: 'number', value: source.slice(begin, at) }); continue;
      }
      if (c === '}') {
        if (interpolation && braces === 0) return { result, end: at + 1 };
        braces--;
      }
      if (c === '{') braces++;
      result.push({ kind: 'punctuation', value: c }); at++;
    }
    if (interpolation) throw Error('unterminated-template-expression');
    return { result, end: at };
  };
  return scan(0).result;
}

function importReferences(source) {
  const references = [];
  const visit = list => {
    const literal = (at, operation) => {
      const target = list[at];
      if (target?.kind !== 'string') throw Error(`unresolved-${operation}-expression`);
      return target.value;
    };
    for (let i = 0; i < list.length; i++) {
      const current = list[i];
      for (const embedded of current.embedded ?? []) visit(embedded);
      if (current.kind !== 'word' || !['import', 'export', 'require'].includes(current.value) || list[i - 1]?.value === '.' || list[i + 1]?.value === ':') continue;
      if (current.value === 'import' && list[i + 1]?.value === '.') continue; // import.meta is not an import edge.
      if (['import', 'require'].includes(current.value) && list[i + 1]?.value === '(') {
        const target = literal(i + 2, current.value);
        if (![')', ','].includes(list[i + 3]?.value) || current.value === 'require' && list[i + 3]?.value !== ')') throw Error(`unresolved-${current.value}-expression`);
        references.push(target); continue;
      }
      if (current.value === 'require') continue;
      if (current.value === 'import' && list[i + 1]?.kind === 'string') { references.push(list[i + 1].value); continue; }
      // Only named/star re-exports can contain a module specifier. Function,
      // class, const and default exports contain ordinary executable code.
      if (current.value === 'export' && !['{', '*'].includes(list[i + 1]?.value)) continue;
      let j = i + 1, depth = 0;
      for (; j < list.length; j++) {
        if (list[j].value === '{') depth++;
        if (list[j].value === '}') depth--;
        if (depth === 0 && list[j].value === 'from') { references.push(literal(j + 1, current.value)); break; }
        if (depth === 0 && list[j].value === ';') break;
        if (current.value === 'export' && depth === 0 && list[j].value === '}' && list[j + 1]?.value !== 'from') break;
      }
      if (current.value === 'import' && (j === list.length || list[j].value !== 'from')) throw Error('unresolved-static-import');
    }
  };
  visit(tokens(source));
  return references;
}

const builtin = new Set(builtinModules.flatMap(name => [name, `node:${name}`]));
function localTarget(importer, specifier, packages = new Set()) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    if (builtin.has(specifier) || packages.has(packageName)) return null;
    throw Error(`unresolved-package-import: ${importer} -> ${specifier}`);
  }
  const base = new URL(importer, 'https://offline.invalid/');
  const url = new URL(specifier, base);
  const target = decodeURIComponent(url.pathname).replace(/^\//, '');
  if (url.origin !== base.origin || target.split('/').includes('..') || /[\\\p{C}]/u.test(target)) throw Error('unsafe-local-import');
  if (target.split('/').includes('research') || target.split('/').includes('test') || /(?:^|\/)fixtures?(?:\/|\.)/.test(target)) throw Error(`nonproduction-dependency: ${importer} -> ${target}`);
  return target;
}

async function graphFor(roots, read, packages = new Set(), resolveTarget = localTarget) {
  const seen = new Set(), edges = [];
  const visit = async file => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = await read(file);
    for (const specifier of importReferences(source)) {
      const target = resolveTarget(file, specifier, packages);
      edges.push({ from: file, target: target ?? specifier, external: target === null });
      if (target !== null) await visit(target); // A missing module is a test failure.
    }
  };
  for (const root of roots) await visit(root);
  return { files: [...seen].sort(), edges };
}

async function codeFiles(directory) {
  const result = [];
  for (const entry of await readdir(path.join(ROOT, directory), { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await codeFiles(file));
    else if (/\.(?:mjs|js)$/.test(entry.name)) result.push(file);
  }
  return result.sort();
}

function htmlEntrypoints(html) {
  const scripts = [], stack = [parse(html)];
  while (stack.length) {
    const node = stack.pop();
    if (node.tagName === 'script') {
      const src = node.attrs.find(attr => attr.name === 'src')?.value;
      if (src && !/^https?:\/\//.test(src)) scripts.push(src.replace(/^\/?/, ''));
      if (!src) assert.deepEqual(importReferences((node.childNodes ?? []).filter(child => child.nodeName === '#text').map(child => child.value).join('')), [], 'Inline HTML scripts must not introduce an unaudited module graph.');
    }
    stack.push(...node.childNodes ?? []);
  }
  return scripts;
}

test('lexical dependency scanner follows static, re-export, dynamic and nested-template imports without parsing prose as code', () => {
  const sample = [
    `// import './research/comment.mjs';`,
    `/* export * from './research/comment2.mjs'; */`,
    `const prose = "import('./research/string.mjs')";`,
    `const pattern = /import\\(['"]research[\\/]/g;`,
    `const escaped = 'it\\\'s inert'; object.import('not-a-module');`,
    `import './side-effect.mjs'; import { one as other } from './named.mjs';`,
    `export { value as renamed } from './reexport.mjs'; export * as namespace from './star.mjs';`,
    `export function ordinary() { return 'from ./research/inert.mjs'; }`,
    `const lazy = import ( /* a literal */ './lazy.mjs', { with: { type: 'json' } });`,
    'const expression = `text ${import("./inside-template.mjs")}`;',
    'const noSubstitution = import(`./literal-template.mjs`);',
    `const common = require('./common.cjs'); const ownURL = import.meta.url;`,
  ].join('\n');
  assert.deepEqual(importReferences(sample), ['./side-effect.mjs', './named.mjs', './reexport.mjs', './star.mjs', './lazy.mjs', './inside-template.mjs', './literal-template.mjs', './common.cjs']);
  assert.deepEqual(importReferences(`export { local }; const from = 'ordinary'; ({ import: 'a property' });`), []);
});

test('unknown import expressions fail closed, including interpolation and literal concatenation', () => {
  for (const source of ['import(target)', 'import("./" + target)', 'import(`./${target}.mjs`)', 'require(target)', 'require("./" + target)']) {
    assert.throws(() => importReferences(source), /unresolved-(?:import|require)-expression/, source);
  }
  assert.throws(() => importReferences("import { value } from target;"), /unresolved-import-expression/);
  assert.throws(() => importReferences("export * from target;"), /unresolved-export-expression/);
});

test('authored dependency graphs detect transitive research/static/dynamic edges and unresolved modules without external I/O', async () => {
  const readMap = files => file => {
    assert.ok(Object.hasOwn(files, file), `Missing authored dependency ${file}`);
    return files[file];
  };
  for (const edge of [`import '../research/pilot.mjs';`, `export * from '../research/pilot.mjs';`, `import('../research/pilot.mjs');`, `import('../%72esearch/pilot.mjs');`, `import('../\\u0072esearch/pilot.mjs');`]) {
    await assert.rejects(graphFor(['netlify/entry.mjs'], readMap({ 'netlify/entry.mjs': `import './child.mjs';`, 'netlify/child.mjs': edge })), /nonproduction-dependency/);
  }
  await assert.rejects(graphFor(['entry.mjs'], readMap({ 'entry.mjs': `import('./missing.mjs')` })), /Missing authored dependency/);
  await assert.rejects(graphFor(['entry.mjs'], readMap({ 'entry.mjs': `import(name)` })), /unresolved-import-expression/);
  await assert.rejects(graphFor(['entry.mjs'], readMap({ 'entry.mjs': `import 'undeclared-package'` })), /unresolved-package-import/);
  const graph = await graphFor(['entry.mjs'], readMap({ 'entry.mjs': `import './safe.mjs'; const prose = "import('./research/pilot.mjs')";`, 'safe.mjs': `export { value };` }));
  assert.deepEqual(graph.files, ['entry.mjs', 'safe.mjs']);
});

test('production Function, all server libraries and browser code have no direct/transitive/dynamic pilot dependencies', async t => {
  const packageData = JSON.parse(await localRead('package.json'));
  const packages = new Set(Object.keys(packageData.dependencies ?? {}));
  const serverRoots = ['netlify/functions/media-advice.mjs', ...await codeFiles('netlify/lib')];
  const browserRoots = [...htmlEntrypoints(await localRead('app.html')), 'app.js', ...await codeFiles('assets'), ...await codeFiles('shared')];
  const server = await graphFor(serverRoots, localRead, packages);
  const browser = await graphFor(browserRoots, localRead, packages);
  assert.ok(server.files.includes('netlify/functions/media-advice.mjs'));
  assert.ok(browser.files.includes('assets/media-advice.mjs'));
  for (const file of RUNTIME_FILES) assert.ok(server.files.includes(file), `Runtime module must participate in the audited graph: ${file}`);
  for (const file of browser.files) {
    for (const token of tokens(await localRead(file))) if (token.kind === 'string' && /^(?:\/|(?:\.\.?\/)+)(?:research|test)(?:\/|$)/.test(token.value)) assert.fail(`Browser pilot resource dependency in ${file}: ${token.value}`);
  }
  t.diagnostic(`Offline graph: ${server.files.length} server modules / ${server.edges.length} import edges; ${browser.files.length} browser modules / ${browser.edges.length} import edges; no research nodes.`);
});

test('extracted runtime modules exclude demo catalogues, fixed scenarios, prompts and synthetic fixture builders', async () => {
  const forbidden = new Set(['TMDB_FILMS', 'MOTN_FILMS', 'HELD_OUT_FILMS', 'HTML_CARDS', 'KINOBAZA_CARDS', 'APPLE_UA_CARDS', 'DISCOVERY_IDS',
    'FILMS', 'SYNTHETIC_FILMS', 'MODEL', 'PROMPT', 'MAX_OUTPUT_TOKENS', 'selectRequest', 'selectFilm', 'requestBody',
    'tmdbScenario', 'motnScenario', 'htmlScenario', 'urlScenario', 'discoveryScenario', 'runDiscovery',
    'syntheticTmdb', 'projectSyntheticTmdb', 'syntheticMotn', 'syntheticHtml', 'syntheticResponse', 'authoredDiscoveryData']);
  for (const file of RUNTIME_FILES) {
    for (const token of tokens(await localRead(file))) if (token.kind === 'word') assert.ok(!forbidden.has(token.value), `Demo-only identifier ${token.value} in ${file}`);
  }
});

test('canonical product fixtures have a closed test-only graph; retired compatibility paths are absent', async t => {
  const names = ['assisted-kinobaza', 'film-workflow', 'kinobaza-localization', 'recommendation-markup'];
  const canonical = names.map(name => `test/${name}.fixture.mjs`);
  const allowed = [...canonical, 'test/kinobaza-html.fixture.mjs'].sort();
  const fixtureTarget = (importer, specifier) => {
    assert.ok(specifier.startsWith('.'), `Fixture imports must stay local: ${importer} -> ${specifier}`);
    const target = decodeURIComponent(new URL(specifier, new URL(importer, 'https://offline.invalid/')).pathname).slice(1);
    assert.ok(allowed.includes(target), `Fixture closure escaped test data: ${importer} -> ${target}`);
    return target;
  };
  const graph = await graphFor(canonical, localRead, new Set(), fixtureTarget);
  assert.deepEqual(graph.files, allowed);
  assert.deepEqual(graph.edges.map(({ from, target }) => [from, target]), [
    ['test/assisted-kinobaza.fixture.mjs', 'test/kinobaza-localization.fixture.mjs'],
    ['test/kinobaza-localization.fixture.mjs', 'test/kinobaza-html.fixture.mjs'],
  ]);
  for (const name of names) {
    const legacyPath = `research/grounded-answer-demo/test/${name}.fixture.mjs`;
    await assert.rejects(localRead(legacyPath), { code: 'ENOENT' }, 'Retired wrappers must not silently return.');
  }
  for (const name of ['assisted-kinobaza', 'kinobaza-localization']) {
    await assert.rejects(localRead(`research/grounded-answer-demo/${name}.mjs`), { code: 'ENOENT' });
  }
  const retiredEntries = await readdir(path.join(ROOT, 'research/grounded-answer-demo'), { recursive: true, withFileTypes: true })
    .catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  assert.deepEqual(retiredEntries.filter(entry => !entry.isDirectory()), [],
    'No retired launcher/UI/demo files may return; empty working-tree directories are not tracked Git content. Historical parity uses Git objects.');
  t.diagnostic(`Fixture closure: ${graph.files.length} test-only modules / ${graph.edges.length} import edges; no research, runtime, packages or transport.`);
});

test('TMDb logo uses a production asset path with unchanged bytes and attribution', async () => {
  const source = await localRead('assets/media-advice.mjs');
  assert.match(source, /logo\.src\s*=\s*['"]\/assets\/icons\/tmdb\.svg['"]/);
  assert.doesNotMatch(source, /\/research\/grounded-answer-demo\/public\/tmdb-logo\.svg/);
  const current = await readFile(path.join(ROOT, 'assets/icons/tmdb.svg'));
  const previous = execFileSync('git', ['show', `${MEDIA_ADVICE_BASELINE_SHA}:research/grounded-answer-demo/public/tmdb-logo.svg`],
    { cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  // Git stores this text SVG with LF; Windows checkout conversion can give
  // only one of the two copies CRLF. Compare repository-normalized bytes, not
  // that checkout-only newline representation. No other byte repair is used.
  const gitText = bytes => Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
  assert.deepEqual(gitText(current), gitText(previous), 'Moving attribution artwork must not alter its repository bytes.');
  assert.match(current.toString('utf8'), /<svg\b/);
  assert.match(source, /logo\.alt\s*=\s*['"]TMDB['"]/);
  assert.match(source, /logo\.width\s*=\s*110\b/);
  assert.match(source, /https:\/\/www\.themoviedb\.org/);
  assert.match(source, /not endorsed or certified by TMDB/);
});

test('all fourteen migrated product scenarios execute with current research modules forbidden, including transitive imports', () => {
  const suites = ['kinobaza-contextual-policy', 'kinobaza-deferred-extraction', 'kinobaza-localized-identity',
    'kinobaza-movie-director-group', 'kinobaza-slevin-profile-pipeline', 'kinobaza-terminal-roman', 'kinobaza-ukrainian-g',
    'media-advice-diagnostics', 'media-advice-kinobaza-pipeline', 'apple-subscription-mapping',
    'media-advice-browser', 'media-advice-platform-ui', 'kinobaza-source-contracts'];
  const urls = [...suites.map(name => new URL(`./${name}.test.mjs`, import.meta.url).href),
    new URL('./media-advice-group.fixture.mjs', import.meta.url).href];
  const code = `import { registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, nextResolve) {
      const result = nextResolve(specifier, context);
      if (result.url.startsWith('file:') && new URL(result.url).pathname.includes('/research/')) throw Error('current-research-module-forbidden');
      return result;
    } });
    globalThis.fetch = () => { throw Error('external-transport-forbidden'); };
    for (const url of ${JSON.stringify(urls)}) await import(url);
    const group = await import(${JSON.stringify(new URL('./media-advice-group.fixture.mjs', import.meta.url).href)});
    await group.authoredDuneMediaResult();
    console.log('fourteen-product-scenarios-without-current-research');`;
  // Node's parent test runner exports a binary child-reporting context. This
  // independently spawned suite must use its own ordinary TAP reporter.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  // Browser behavior is exercised separately with its opt-in runner. This
  // import-closure check must remain offline and deterministic in both runs.
  delete env.PLAYWRIGHT_MODULE_PATH;
  const output = execFileSync(process.execPath, ['--test-reporter=tap', '--input-type=module', '-e', code], {
    encoding: 'utf8', windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'], env,
  });
  assert.match(output, /fourteen-product-scenarios-without-current-research/);
  assert.match(output, /# fail 0\b/);
});

test('raw HTML extraction refuses synthetic fixture identity without an independent product callback', async () => {
  const { extractHtml: runtimeExtract } = await import('../netlify/lib/kinobaza-html.mjs');
  const { localizedMarkup } = await import('./kinobaza-localization.fixture.mjs');
  const { SYNTHETIC_FILMS } = await import('./kinobaza-html.fixture.mjs');
  for (const id of ['coherence', 'dune-part-two']) {
    const film = SYNTHETIC_FILMS[id], html = localizedMarkup('', id);
    const required = await runtimeExtract(html, film);
    assert.equal(required.identity.status, 'unresolved');
    assert.equal(required.identity.reason, 'identity-check-required');
    assert.deepEqual(required.candidates, [], 'Authored title/director text is not an implicit identity proof.');
  }
});

test('product fixture uses actual identity gates before exposing source languages or exact URLs', async () => {
  const { authoredProductFilm, authoredProductHTML, extractProductHTML } = await import('./media-advice-group.fixture.mjs');
  const { tableBlock } = await import('./kinobaza-localization.fixture.mjs');
  const exact = 'https://itunes.apple.com/ua/movie/id9999001?at=AUTHOR%2fONLY';
  for (const id of ['coherence', 'dune-part-two']) {
    const film = authoredProductFilm(id);
    const html = authoredProductHTML(film, tableBlock('itunes', [['Укр. звук', '+'], ['Укр. субтитри', '−']], exact));
    const good = await extractProductHTML(html, film);
    assert.equal(good.identity.status, 'matched');
    assert.equal(good.identity.reason, 'explicit-title-year-director-match');
    assert.equal(good.identity.diagnostics.strategy, 'title-year-director');
    assert.ok(good.candidates.some(candidate => candidate.href === exact));
    assert.equal(good.localization.blocks[0].audio.state, 'reported-positive');
    assert.equal(good.localization.blocks[0].subtitles.state, 'reported-negative');
    const mutations = [
      ['wrong heading', html.replace(`<h1>${film.identityTitle}`, '<h1>Other film')],
      ['wrong original', html.replace(`<h2>${film.originalTitle}</h2>`, '<h2>Other original</h2>')],
      ['wrong year', html.replace(`(${film.year})</h1>`, `(${film.year + 1})</h1>`)],
      ['wrong director', html.replace(film.director, 'Other authored director')],
      ['wrong canonical', html.replace(`/titles/${film.id}`, '/titles/other-film')],
      ['conflicting ID', html.replace('</table>', '<tr><td>IMDb:</td><td>tt999900002</td></tr></table>')],
      ['ambiguous heading', html.replace('</h1>', '</h1><h1>Other film (2013)</h1>')],
      ['ambiguous original', html.replace('</h2>', '</h2><h2>Other original</h2>')],
      ['ambiguous director', html.replace('</table>', '<tr><td>Режисер:</td><td>Other authored director</td></tr></table>')],
    ];
    for (const [label, value] of mutations) {
      const rejected = await extractProductHTML(value, film);
      assert.notEqual(rejected.identity.status, 'matched', `${id}: ${label}`);
      assert.deepEqual(rejected.candidates, [], `${label}: no source pointers escape identity refusal`);
      assert.deepEqual(rejected.localization?.blocks ?? [], [], `${label}: no source language claims escape identity refusal`);
    }
  }
});
