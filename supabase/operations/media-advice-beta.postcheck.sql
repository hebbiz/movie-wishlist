-- Read-only after the new migration, before any separate activation.
select (select count(*) from auth.users) as auth_users,
       (select count(*) from media_advice_private.user_regions) as region_rows,
       (select count(*) from auth.users u left join media_advice_private.user_regions r
          on r.user_id = u.id where r.user_id is null) as users_without_region,
       (select count(*) from public.movies) as movies,
       (select count(*) from public.movie_group_lists) as movie_group_lists,
       (select count(*) from public.group_members) as group_members,
       (select enabled from media_advice_private.beta_config where singleton) as beta_enabled;

select r.rolname,
       has_function_privilege(r.rolname,
         'public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text)', 'execute') as beta_rpc_execute,
       has_schema_privilege(r.rolname, 'media_advice_private', 'usage') as private_schema_usage,
       has_table_privilege(r.rolname, 'media_advice_private.user_regions', 'insert,update,delete') as region_write,
       has_table_privilege(r.rolname, 'media_advice_private.beta_config', 'insert,update,delete') as config_write
from pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role') order by r.rolname;

select c.relname, c.relrowsecurity from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'media_advice_private'
  and c.relname in ('user_regions', 'beta_config', 'permissions', 'sessions') order by c.relname;

select count(*) as diagnostics_assignments,
       count(*) filter(where enabled and (expires_at is null or expires_at > clock_timestamp())) as active_diagnostics_assignments
from media_advice_private.permissions where feature_key = 'mykola_media_advice_diagnostics';

select count(*) as region_trigger_count from pg_trigger
where tgrelid = 'auth.users'::regclass and tgname = 'media_advice_set_default_region'
  and not tgisinternal and tgenabled = 'O';

-- Expected: one exact history entry, recorded by the authorized migration path.
-- Applying SQL alone is not proof that this history row exists.
select version, name,
       version='20261031135149' and name='media_advice_beta_ua' as exact_beta_history
from supabase_migrations.schema_migrations where version='20261031135149';
select count(*)=1 as exactly_one_beta_history from supabase_migrations.schema_migrations
where version='20261031135149' and name='media_advice_beta_ua';

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns where table_schema='media_advice_private'
  and table_name in ('user_regions', 'beta_config') order by table_name, ordinal_position;
select c.conrelid::regclass::text as table_name, c.conname,
       pg_get_constraintdef(c.oid, true) as definition
from pg_constraint c where c.conrelid in (
  'media_advice_private.user_regions'::regclass, 'media_advice_private.beta_config'::regclass,
  'media_advice_private.permissions'::regclass
) order by table_name, c.conname;

select p.oid::regprocedure::text as signature, p.prosecdef as security_definer,
       p.provolatile as volatility, p.proconfig as function_settings
from pg_proc p where p.oid in (
  'public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'::regprocedure,
  'media_advice_private.assert_beta_access(uuid,uuid,text,uuid)'::regprocedure,
  'media_advice_private.set_default_user_region()'::regprocedure
) order by signature;

-- Inspect explicit and default PUBLIC grants, as well as effective privileges
-- inherited by the browser/server roles (has_*_privilege above).
select p.oid::regprocedure::text as signature,
       case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee)::text end as grantee,
       a.privilege_type, a.is_grantable
from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
where p.oid in (
  'public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'::regprocedure,
  'media_advice_private.assert_beta_access(uuid,uuid,text,uuid)'::regprocedure,
  'media_advice_private.set_default_user_region()'::regprocedure
) order by signature, grantee;
select c.relname,
       case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee)::text end as grantee,
       a.privilege_type, a.is_grantable
from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
where c.oid in ('media_advice_private.user_regions'::regclass, 'media_advice_private.beta_config'::regclass)
order by c.relname, grantee, a.privilege_type;

select pg_get_triggerdef(oid, true) as region_trigger_definition from pg_trigger
where tgrelid='auth.users'::regclass and tgname='media_advice_set_default_region' and not tgisinternal;

select p.oid::regprocedure::text as signature, md5(pg_get_functiondef(p.oid)) as definition_fingerprint
from pg_proc p where p.oid in (
  'public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'::regprocedure,
  'public.media_advice_cleanup()'::regprocedure
) order by signature;
