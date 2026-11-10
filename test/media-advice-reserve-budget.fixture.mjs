import { readFile } from 'node:fs/promises';
import { identityBudgetDb, identityBudgetSql, stages } from './media-advice-identity-budget.fixture.mjs';
export const reserveBudgetSql = () => readFile(new URL('../supabase/migrations/20261102181617_media_advice_exact_reserve_budget.sql',import.meta.url),'utf8');
export const reserveStages = [...stages,'search-3','kinobaza-3'];
export const reserveStartContract = 'reserve-exact-v1';
export async function reserveBudgetDb(){
  const context=await identityBudgetDb();await context.db.exec(await reserveBudgetSql());
  const rpc=(op,args={})=>context.rpc(op,op==='start'?{stage:reserveStartContract,...args}:args);
  return {...context,rpc};
}
export { identityBudgetSql };
