// Authored in-memory schema only. No project, credentials or real-user rows.
import { readFile, readdir } from 'node:fs/promises';
import { predictedBudgetDb } from './media-advice-predicted-budget.fixture.mjs';
import { user, form } from './media-advice-beta-db.fixture.mjs';

export const globalStartContract = 'global-predicted-card-v1';
export const globalRpcSql = 'select public.media_advice_beta_global_action($1,$2,$3,$4,$5,$6) as result';
export async function globalAccessSql() {
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const names = (await readdir(directory)).filter(name => /_media_advice_global_access\.sql$/.test(name));
  if (names.length !== 1) throw new Error('expected-one-global-access-migration');
  return readFile(new URL(names[0], directory), 'utf8');
}
export function globalArgs(op, options = {}) {
  const { targetUser = user, imdb = op === 'capability' ? null : 'tt1234567', n = 1, session = null } = options;
  const selectedForm = Object.hasOwn(options, 'targetForm') ? options.targetForm : op === 'capability' ? null : form(n);
  const stage = Object.hasOwn(options, 'stage') ? options.stage : op === 'start' ? globalStartContract : null;
  return [targetUser, imdb, selectedForm, op, session, stage];
}
export async function globalAccessDb() {
  const context = await predictedBudgetDb();
  try { await context.db.exec(await globalAccessSql()); }
  catch (error) { await context.db.close(); throw error; }
  const globalRpc = async (op, args) => (await context.db.query(globalRpcSql, globalArgs(op, args))).rows[0].result;
  return { ...context, globalRpc };
}
