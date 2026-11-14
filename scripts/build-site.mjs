import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publishDir = join(root, '.site-dist');

// Old open tabs may import a previous release's assets URLs after a deploy.
// Keep only these six known entry points as generated ESM forwarding modules:
// one canonical implementation, no duplicated frontend source in assets/Git.
const previousMediaAdviceModules = [
  'media-advice.mjs', 'media-advice-entry-access.mjs', 'media-advice-icons.mjs',
  'media-advice-link-choices.mjs', 'media-advice-presentation.mjs', 'media-advice-report.mjs',
];
// Only these four modules participate in the browser graph. Film identity
// rules are server-only and must never be copied by publishing a whole shared
// directory. Flat shared URLs remain available to previously cached bodies.
const browserSharedModules = [
  'director-profile-diagnostics.mjs', 'media-advice-diagnostics.mjs',
  'media-link-policy.mjs', 'media-search-relevance-diagnostic.mjs',
];

// Product artwork stays under assets; only these exact six browser modules
// are public under src, not every file in that folder or future source trees.
// Server Functions and their source dependencies remain available for bundling.
const publicPaths = [
  'index.html', 'app.html', 'invite.html', 'app.js', 'styles.css',
  'service-worker.js', 'site.webmanifest', 'assets', 'privacy', 'terms',
  ...previousMediaAdviceModules.map(name => `src/media-advice/${name}`),
  ...browserSharedModules.map(name => `shared/media-advice/${name}`),
];

export function buildSite() {
  rmSync(publishDir, { recursive: true, force: true });
  mkdirSync(publishDir, { recursive: true });
  for (const relativePath of publicPaths) {
    const destination = join(publishDir, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(root, relativePath), destination, { recursive: true, errorOnExist: true,
      // Icon provenance/docs remain tracked, not part of the browser resource graph.
      filter: source => !/\.md$/i.test(source),
    });
  }
  for (const name of previousMediaAdviceModules) {
    writeFileSync(join(publishDir, 'assets', name), `export * from '../src/media-advice/${name}';\n`, { flag: 'wx' });
  }
  for (const name of browserSharedModules) {
    writeFileSync(join(publishDir, 'shared', name), `export * from './media-advice/${name}';\n`, { flag: 'wx' });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildSite();
}
