import { readFile, readdir } from 'node:fs/promises';
import { betaDb } from './media-advice-beta-db.fixture.mjs';

export const stages = ['tmdb-find', 'tmdb-details', 'tmdb-providers', 'motn-title',
  'search-1', 'search-2', 'kinobaza-1', 'kinobaza-2', 'tmdb-person', 'kinobaza-person'];

export async function identityBudgetSql() {
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const files = (await readdir(directory)).filter(f => /_media_advice_identity_budget\.sql$/.test(f));
  if (files.length !== 1) throw new Error('expected-one-identity-budget-migration');
  return readFile(new URL(files[0], directory), 'utf8');
}

export async function identityBudgetDb() {
  const result = await betaDb();
  await result.db.exec(await identityBudgetSql());
  return result;
}
