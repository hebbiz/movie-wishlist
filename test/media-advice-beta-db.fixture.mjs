import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export const user = '00000000-0000-4000-8000-000000000001';
export const group = '00000000-0000-4000-8000-000000000002';
export const list = '00000000-0000-4000-8000-000000000003';
export const secondUser = '00000000-0000-4000-8000-000000000004';
export const form = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// Authored prerequisite schema, not a production schema dump/history replay.
export const fixtureSql = `create role anon; create role authenticated; create role service_role;
  create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
  create table public.groups(id uuid primary key);
  create table public.group_members(user_id uuid, group_id uuid, role text);
  create table public.movies(id uuid primary key, imdb_id text);
  create table public.movie_group_lists(id uuid primary key, movie_id uuid, group_id uuid);
  insert into auth.users(id) values('${user}'); insert into public.groups values('${group}');
  insert into public.group_members values('${user}','${group}','member');
  insert into public.movies values('${list}','tt1234567');
  insert into public.movie_group_lists values('${list}','${list}','${group}');`;

export async function migrationSql() {
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const beta = (await readdir(directory)).filter(f => /_media_advice_beta_ua\.sql$/.test(f));
  if (beta.length !== 1) throw new Error('expected-one-beta-migration');
  return Promise.all(['20261020205122_media_advice_access_ledger.sql',
    '20261021072002_media_advice_review_fixes.sql', beta[0]].map(f => readFile(new URL(f, directory), 'utf8')));
}

export const rpcSql = 'select public.media_advice_beta_action($1,$2,$3,$4,$5,$6,$7,$8) as result';
export function rpcArgs(op, { targetUser = user, targetGroup = group, targetList = list,
  imdb = 'tt1234567', n = 1, session = null, stage = null } = {}) {
  return [targetUser, targetGroup, imdb, targetList, form(n), op, session, stage];
}

export async function betaDb() {
  const db = new PGlite();
  await db.exec(fixtureSql);
  for (const sql of await migrationSql()) await db.exec(sql);
  const rpc = async (op, args) => (await db.query(rpcSql, rpcArgs(op, args))).rows[0].result;
  return { db, rpc };
}
