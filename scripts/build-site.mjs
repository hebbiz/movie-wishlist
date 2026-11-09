import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publishDir = join(root, '.site-dist');

// Keep original public URL paths: product artwork lives under assets and
// shared modules are imported directly by browser-side JavaScript. Server
// functions and their source dependencies remain in the repository for bundling.
const publicPaths = [
  'index.html', 'app.html', 'invite.html', 'app.js', 'styles.css',
  'service-worker.js', 'site.webmanifest', 'assets', 'shared', 'privacy', 'terms',
];

export function buildSite() {
  rmSync(publishDir, { recursive: true, force: true });
  mkdirSync(publishDir, { recursive: true });
  for (const relativePath of publicPaths) {
    const destination = join(publishDir, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(root, relativePath), destination, { recursive: true, errorOnExist: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildSite();
}
