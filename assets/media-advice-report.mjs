const identities = new Set(['matched', 'mismatch', 'unresolved']);
const stages = ['tmdb-find', 'tmdb-details', 'tmdb-providers', 'motn-title', 'search-1', 'search-2', 'kinobaza-1', 'kinobaza-2'];
const knownReasons = new Set(['source-canonical-conflict','source-stable-id-conflict','source-canonical-ambiguous','malformed-source-stable-id','source-identity-structure-incomplete','source-original-title-unestablished','source-original-title-scope-unestablished','source-title-conflict','source-title-year-missing','selected-year-missing','source-year-conflict-without-stable-crosswalk','source-or-selected-director-missing','director-scope-unestablished','director-alias-unestablished','explicit-stable-and-structural-match','explicit-title-year-director-match']);
const count = n => Number.isSafeInteger(n) && n >= 0 && n < 10000 ? n : 'unknown';
const loc = s => ['reported-positive','reported-negative','conflicting'].includes(s) ? s : 'unknown';
export function safeMediaReport(result, { applied = false } = {}) {
  const rows = result?.rows ?? [];
  const lines = ['MW-FUT-01 M4 — source claims, not entitlement.', 'Commit: unknown (not runtime-attested).',
    `Source HTTP attempts: ${count(result?.metrics?.requestsMade)}/${count(result?.metrics?.requestBudget)}. No automatic retry.`,
    `Durable ledger reservations: ${count(result?.metrics?.ledgerReservations)}; a lost reservation response does not authorize a retry.`,
    `Mapped source rows: ${count(rows.length)}; other-platform rows: ${count(result?.unmapped?.length)}.`];
  for (const source of ['tmdb','motn','kinobaza']) {
    const s = result?.sources?.find(s => s.source === source);
    lines.push(`${source}: identity ${identities.has(s?.identity) ? s.identity : 'unresolved'}; source outcomes/details remain on page.`);
  }
  for (const stage of stages) lines.push(`${stage}: ${count(result?.metrics?.calls?.filter(c => c.stage === stage).length)} reserved.`);
  lines.push(`Kinobaza: search ${count(result?.resolver?.searchCalls)}; card GET ${count(result?.resolver?.cardCalls)}; unexamined ${count(result?.resolver?.unexamined)}.`);
  for (const card of result?.resolver?.cards?.slice(0,2) ?? []) lines.push(`Card: ${identities.has(card.identity) ? card.identity : 'unresolved'}; reason ${knownReasons.has(card.reason) ? card.reason : 'unknown'}.`);
  lines.push(`Film-level UA audio badge: ${loc(result?.filmLocalization?.ukrainianAudio?.state)}; not provider tracks.`);
  for (const r of rows.slice(0, 24)) {
    const source = ['tmdb','motn','kinobaza'].find(s => r.id?.startsWith(s + ':') || r.id?.includes(':' + s + ':')) ?? 'unknown';
    const platform = ['apple','prime','netflix','hbo','rakuten','megogo'].includes(r.provider?.key) ? r.provider.key : 'unmapped';
    const b = r.kinobazaLocalization;
    lines.push(`${source}/${platform}: ${r.country === 'UA' ? 'UA source context' : 'territory unknown'}; provider-block audio ${loc(b?.audio?.state)}, subtitles ${loc(b?.subtitles?.state)}; offer binding unverified.`);
  }
  lines.push(applied ? 'Local form transfer performed; not saved by this feature.' : 'No attested transfer/save in this report.');
  return lines.join('\n');
}
