-- Read-only. Run on the explicitly verified target project before applying
-- the single Beta migration, not as a substitute for recovery evidence.
select current_database() as database_name,
       current_setting('server_version') as server_version,
       to_regclass('auth.users') is not null as auth_users_present,
       to_regclass('public.group_members') is not null as group_members_present,
       to_regclass('public.movies') is not null as movies_present,
       to_regclass('public.movie_group_lists') is not null as lists_present,
       to_regclass('media_advice_private.permissions') is not null as permissions_present,
       to_regclass('media_advice_private.sessions') is not null as ledger_present,
       to_regclass('media_advice_private.user_regions') is null as region_name_available,
       to_regclass('media_advice_private.beta_config') is null as config_name_available,
       to_regprocedure('public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text)') is null as rpc_name_available,
       to_regprocedure('media_advice_private.set_default_user_region()') is null as trigger_function_name_available,
       to_regprocedure('media_advice_private.assert_beta_access(uuid,uuid,text,uuid)') is null as access_helper_name_available,
       not exists (select 1 from pg_trigger where tgrelid='auth.users'::regclass
         and tgname='media_advice_set_default_region' and not tgisinternal) as trigger_name_available;

-- Content-free baseline counts only; compare before/after on the same target.
select (select count(*) from auth.users) as auth_users,
       (select count(*) from public.movies) as movies,
       (select count(*) from public.movie_group_lists) as movie_group_lists,
       (select count(*) from public.group_members) as group_members,
       (select count(*) from media_advice_private.permissions) as permissions;

-- Review the actual complete history, not an assumption that 001-016 ran.
select version, name from supabase_migrations.schema_migrations order by version;

select c.conname, pg_get_constraintdef(c.oid, true) as definition
from pg_constraint c where c.conrelid='media_advice_private.permissions'::regclass
  and c.conname='permissions_feature_key_check';

-- Record these privately to compare unchanged legacy RPC/cleanup definitions
-- after the migration. No user data or secrets are present in these functions.
select p.oid::regprocedure::text as signature, p.prosecdef as security_definer,
       p.proconfig as function_settings, md5(pg_get_functiondef(p.oid)) as definition_fingerprint
from pg_proc p where p.oid in (
  'public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'::regprocedure,
  'public.media_advice_cleanup()'::regprocedure
) order by signature;
