import { readFile } from 'node:fs/promises';
import { reserveBudgetDb, reserveBudgetSql, reserveStages, identityBudgetSql } from './media-advice-reserve-budget.fixture.mjs';
export const predictedBudgetSql = () => readFile(new URL('../supabase/migrations/20261104210025_media_advice_predicted_card_budget.sql', import.meta.url), 'utf8');
export const predictedStages = [...reserveStages, 'kinobaza-predicted', 'kinobaza-person-predicted'];
export const predictedStartContract = 'predicted-card-v1';
export async function predictedBudgetDb() {
  const context = await reserveBudgetDb(); await context.db.exec(await predictedBudgetSql());
  const rpc = (op, args = {}) => context.rpc(op, op === 'start' ? { stage: predictedStartContract, ...args } : args);
  return { ...context, rpc };
}
export { identityBudgetSql, reserveBudgetSql };
