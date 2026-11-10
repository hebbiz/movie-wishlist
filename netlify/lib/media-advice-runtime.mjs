import { randomUUID } from 'node:crypto';
import build from './media-advice-build.mjs';
export function mediaRuntime(context, evidence = build) {
  const deployed = /^[a-f0-9]{24}$/.test(context?.deploy?.id ?? '');
  const attested = deployed && context.deploy.id === evidence.deployId && evidence.provenance === 'netlify-build-commit-ref-and-git-head' && /^[a-f0-9]{40}$/.test(evidence.sha ?? '');
  return { execution: deployed ? 'netlify-function' : 'unattested-runtime', buildSha: attested ? evidence.sha : null,
    buildProvenance: attested ? evidence.provenance : 'unknown', deployId: deployed ? context.deploy.id : null, runId: randomUUID() };
}
