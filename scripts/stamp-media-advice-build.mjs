import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function buildEvidence(env, gitHead) {
  const valid = env.NETLIFY === 'true' && env.CONTEXT === 'branch-deploy' && env.BRANCH === 'develop' &&
    /^[a-f0-9]{40}$/.test(env.COMMIT_REF ?? '') && env.COMMIT_REF === gitHead && /^[a-f0-9]{24}$/.test(env.DEPLOY_ID ?? '');
  return valid ? { sha: env.COMMIT_REF, deployId: env.DEPLOY_ID, provenance: 'netlify-build-commit-ref-and-git-head' } : { sha: null, deployId: null, provenance: 'unknown' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let head; try { head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding:'utf8', stdio:['ignore','pipe','ignore'] }).trim(); } catch {}
  // Contains only public build identifiers; never enumerates/serializes env.
  writeFileSync(new URL('../netlify/lib/media-advice-build.mjs', import.meta.url), `export default Object.freeze(${JSON.stringify(buildEvidence(process.env, head))});\n`);
}
