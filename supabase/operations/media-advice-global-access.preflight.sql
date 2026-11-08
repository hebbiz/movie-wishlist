-- PR #233 preflight ONLY. Run on the independently verified Supabase project.
-- No application RPC is called: even capability RPCs are deliberately avoided.
-- Output contains only aggregate counts, catalog metadata and MD5 drift checks;
-- no auth emails, user/group/session UUIDs, film IDs, source URLs or credentials.
-- MD5 is a comparison fingerprint, NOT a cryptographic backup integrity proof.
-- Prerequisites are the previously deployed M4 tables and migration-history
-- table. Missing prerequisites intentionally abort instead of inventing data.
-- Catalog lookup of the new global function is safe before its installation.
begin read only;
set local statement_timeout = '10s';
set local lock_timeout = '1s';

with
expected_versions(version, purpose) as (values
  ('20261020205122', 'initial-ledger'),
  ('20261021072002', 'ledger-review'),
  ('20261031135149', 'beta-ua'),
  ('20261101180436', 'cap10'),
  ('20261102181617', 'cap12'),
  ('20261104210025', 'cap14'),
  ('20261108185237', 'proposed-global-access')
),
versions as (
  select e.version, e.purpose, count(h.version)::integer as recorded_count
  from expected_versions e left join supabase_migrations.schema_migrations h on h.version = e.version
  group by e.version, e.purpose
),
permission_status as (
  select p.feature_key,
    count(*)::integer as rows,
    count(*) filter (where p.enabled)::integer as enabled_true,
    count(*) filter (where not p.enabled)::integer as enabled_false,
    count(*) filter (where p.expires_at is null)::integer as no_expiry,
    count(*) filter (where p.expires_at > transaction_timestamp())::integer as future_expiry,
    count(*) filter (where p.expires_at <= transaction_timestamp())::integer as expired,
    count(*) filter (where p.enabled and (p.expires_at is null or p.expires_at > transaction_timestamp()))::integer as active
  from media_advice_private.permissions p group by p.feature_key
),
ua_candidates as (
  select p.user_id is not null as has_personal_row,
    coalesce(p.enabled, false) as personal_enabled,
    p.expires_at as personal_expires,
    coalesce(d.enabled and (d.expires_at is null or d.expires_at > transaction_timestamp()), false) as diagnostics_active
  from media_advice_private.user_regions r
  left join media_advice_private.permissions p on p.user_id = r.user_id and p.feature_key = 'mykola_media_advice'
  left join media_advice_private.permissions d on d.user_id = r.user_id and d.feature_key = 'mykola_media_advice_diagnostics'
  where r.region_code = 'UA'
),
permission_intersection as (
  select p.enabled as personal_enabled, p.expires_at as personal_expires,
    r.user_id is not null as has_backend_region, coalesce(r.region_code = 'UA', false) as backend_ua,
    coalesce(d.enabled and (d.expires_at is null or d.expires_at > transaction_timestamp()), false) as diagnostics_active
  from media_advice_private.permissions p
  left join media_advice_private.user_regions r on r.user_id = p.user_id
  left join media_advice_private.permissions d on d.user_id = p.user_id and d.feature_key = 'mykola_media_advice_diagnostics'
  where p.feature_key = 'mykola_media_advice'
),
caps as (
  select source_cap,
    count(*)::integer as rows,
    count(*) filter (where not finished and expires_at > transaction_timestamp())::integer as active,
    count(*) filter (where finished)::integer as finished,
    count(*) filter (where expires_at <= transaction_timestamp())::integer as expired,
    count(*) filter (where group_id is null)::integer as global_scope,
    count(*) filter (where group_id is not null)::integer as legacy_group_scope,
    count(*) filter (where cardinality(attempts) > source_cap)::integer as over_cap
  from media_advice_private.sessions group by source_cap
),
expected_rpcs(signature) as (values
  ('public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'),
  ('public.media_advice_cleanup()'),
  ('public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text)'),
  ('public.media_advice_beta_global_action(uuid,text,uuid,text,uuid,text)'),
  ('media_advice_private.assert_beta_access(uuid,uuid,text,uuid)'),
  ('media_advice_private.assert_beta_feature_access(uuid)'),
  ('media_advice_private.assert_pilot_access(uuid)'),
  ('media_advice_private.detach_beta_feature_assignment()'),
  ('media_advice_private.lock_beta_feature_assignment()'),
  ('media_advice_private.set_default_user_region()'),
  ('media_advice_private.assign_beta_feature(uuid)'),
  ('media_advice_private.sync_beta_feature_region(uuid)'),
  ('media_advice_private.assign_beta_feature_on_region()'),
  ('media_advice_private.assign_beta_feature_on_activation()')
),
rpc_identities as (
  select signature, to_regprocedure(signature)::oid as oid from expected_rpcs
  union all
  select format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)), p.oid
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname = 'media_advice_private' or n.nspname = 'public' and p.proname like 'media_advice%')
    and not exists (select 1 from expected_rpcs e where to_regprocedure(e.signature)::oid = p.oid)
),
rpcs as (
  select e.signature, p.oid is not null as present,
    case when p.oid is not null then md5(pg_get_functiondef(p.oid)) end as definition_md5,
    p.prosecdef as security_definer,
    p.provolatile::text as volatility,
    case when p.oid is not null then pg_get_userbyid(p.proowner) = 'postgres' end as owner_is_postgres,
    case when p.oid is not null then pg_get_userbyid(p.proowner) = 'service_role' end as owner_is_service_role,
    case when p.oid is not null then exists (
      select 1 from unnest(p.proconfig) setting where setting in ('search_path=', 'search_path=""')
    ) end as empty_search_path,
    case when p.oid is not null then has_function_privilege('anon', p.oid, 'EXECUTE') end as anon_execute,
    case when p.oid is not null then has_function_privilege('authenticated', p.oid, 'EXECUTE') end as authenticated_execute,
    case when p.oid is not null then has_function_privilege('service_role', p.oid, 'EXECUTE') end as service_role_execute,
    case when p.oid is not null then exists (
      select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
    ) end as public_execute
  from rpc_identities e left join pg_proc p on p.oid = e.oid
),
triggers as (
  select n.nspname as table_schema, c.relname as table_name, t.tgname as trigger_name,
    t.tgenabled::text as enabled, md5(pg_get_triggerdef(t.oid)) as definition_md5,
    pn.nspname as function_schema, p.proname as function_name,
    md5(pg_get_functiondef(p.oid)) as function_definition_md5
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
  where not t.tgisinternal and (pn.nspname = 'media_advice_private'
    or n.nspname = 'media_advice_private' or t.tgname like 'media_advice%')
),
objects as (
  select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
    pg_get_userbyid(c.relowner) = 'postgres' as owner_is_postgres,
    has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
    has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE') as anon_any_write,
    has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
    has_table_privilege('authenticated', c.oid, 'INSERT') or has_table_privilege('authenticated', c.oid, 'UPDATE') or has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_any_write,
    has_table_privilege('service_role', c.oid, 'SELECT') as service_role_select,
    has_table_privilege('service_role', c.oid, 'INSERT') or has_table_privilege('service_role', c.oid, 'UPDATE') or has_table_privilege('service_role', c.oid, 'DELETE') as service_role_any_write,
    md5(coalesce(c.relacl::text, 'DEFAULT')) as acl_md5,
    (select count(*)::integer from pg_policy p where p.polrelid = c.oid) as policy_count
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'media_advice_private' and c.relkind in ('r', 'p')
),
fingerprints as (
  select 'permissions'::text as object_name, count(*)::integer as rows,
    md5(coalesce(string_agg(row_md5, '' order by row_md5), '')) as rows_md5
  from (select md5(to_jsonb(p)::text) as row_md5 from media_advice_private.permissions p) s
  union all
  select 'user_regions', count(*)::integer, md5(coalesce(string_agg(row_md5, '' order by row_md5), ''))
  from (select md5(to_jsonb(r)::text) as row_md5 from media_advice_private.user_regions r) s
  union all
  select 'beta_config', count(*)::integer, md5(coalesce(string_agg(row_md5, '' order by row_md5), ''))
  from (select md5(to_jsonb(c)::text) as row_md5 from media_advice_private.beta_config c) s
  union all
  select 'sessions', count(*)::integer, md5(coalesce(string_agg(row_md5, '' order by row_md5), ''))
  from (select md5(to_jsonb(s)::text) as row_md5 from media_advice_private.sessions s) s
)
select jsonb_build_object(
  'mode', 'read-only-preflight-no-rpc-no-mutation',
  'checkedAt', transaction_timestamp(),
  'history', (select jsonb_agg(to_jsonb(v) order by version) from versions v),
  'history_summary', jsonb_build_object(
    'total_rows', (select count(*) from supabase_migrations.schema_migrations),
    'latest_any_version', (select max(version) from supabase_migrations.schema_migrations),
    'proposed_after_latest', (select coalesce(max(version) < '20261108185237', true) from supabase_migrations.schema_migrations),
    'duplicate_versions', (select count(*) from (select version from supabase_migrations.schema_migrations group by version having count(*) > 1) d)),
  'global_migration_absent', (select recorded_count = 0 from versions where version = '20261108185237'),
  'global_rpc_absent', to_regprocedure('public.media_advice_beta_global_action(uuid,text,uuid,text,uuid,text)') is null,
  'beta_switch', (select jsonb_build_object('rows', count(*), 'enabled_rows', count(*) filter (where singleton and enabled)) from media_advice_private.beta_config),
  'regions', (select jsonb_build_object('rows', count(*), 'ua', count(*) filter (where region_code = 'UA'), 'non_ua', count(*) filter (where region_code <> 'UA')) from media_advice_private.user_regions),
  'personal_permissions', coalesce((select jsonb_agg(to_jsonb(p) order by feature_key) from permission_status p), '[]'::jsonb),
  'current_explicit_grants_and_pilot_snapshot_candidates', (select jsonb_build_object(
    'all_preexisting_core_rows_for_pilot_snapshot', count(*),
    'active_core_grants_any_region', count(*) filter (where personal_enabled and (personal_expires is null or personal_expires > transaction_timestamp())),
    'active_core_grants_without_backend_ua', count(*) filter (where personal_enabled and (personal_expires is null or personal_expires > transaction_timestamp()) and not backend_ua),
    'core_rows_without_backend_region', count(*) filter (where not has_backend_region),
    'active_core_and_diagnostics_intersection', count(*) filter (where personal_enabled and (personal_expires is null or personal_expires > transaction_timestamp()) and diagnostics_active),
    'preexisting_pilot_scope_with_active_diagnostics', count(*) filter (where diagnostics_active)
  ) from permission_intersection),
  'ua_permission_candidates', (select jsonb_build_object(
    'backend_ua_rows', count(*),
    'missing_personal_row', count(*) filter (where not has_personal_row),
    'new_automatic_rows_if_current_beta_switch_enabled', count(*) filter (where not has_personal_row and exists (select 1 from media_advice_private.beta_config where singleton and enabled)),
    'disabled_personal_row', count(*) filter (where has_personal_row and not personal_enabled),
    'expired_personal_row', count(*) filter (where has_personal_row and personal_enabled and personal_expires <= transaction_timestamp()),
    'active_preexisting_explicit_advice_grant', count(*) filter (where personal_enabled and (personal_expires is null or personal_expires > transaction_timestamp())),
    'active_diagnostics', count(*) filter (where diagnostics_active),
    'active_diagnostics_without_active_personal_advice', count(*) filter (where diagnostics_active and not (personal_enabled and (personal_expires is null or personal_expires > transaction_timestamp())))
  ) from ua_candidates),
  'permission_provenance', jsonb_build_object(
    'backfill_preserves_preexisting_enabled_and_expiry', true,
    'real_region_change_overrides_manual_enabled', true,
    'same_region_update_changes_no_flags_or_ownership', true,
    'expiry_never_automatically_renewed', true,
    'legacy_pilot_scope_requires_separate_snapshot_before_new_assignments', true,
    'legacy_raw_pilot_requires_snapshot_core_diagnostics_and_global_beta', true,
    'region_controls_assignment_and_real_transition_not_runtime_authorization', true,
    'runtime_requires_global_beta_and_personal_flag', true,
    'note', 'Proposed policy: backfill preserves existing decisions. Manual enabled overrides survive until a real backend region transition, which synchronizes enabled with UA plus active Beta; same-region writes do nothing. Original expiry is never renewed. Region events adopt automatic ownership with original expiry. Pilot snapshot includes all old core rows; diagnostics remains separate. Auth is a verified non-anonymous server gate.'),
  'proposed_assignment_objects', jsonb_build_object(
    'automatic_assignments_table_present', to_regclass('media_advice_private.beta_feature_assignments') is not null,
    'pilot_snapshot_table_present', to_regclass('media_advice_private.pilot_access_users') is not null,
    'automatic_assignment_row_count', null,
    'pilot_snapshot_row_count', null,
    'note', 'This before-migration script deliberately does not SELECT from possibly absent new tables; counts stay unknown. Catalog metadata below covers these tables if present.'),
  'session_caps', coalesce((select jsonb_agg(to_jsonb(c) order by source_cap) from caps c), '[]'::jsonb),
  'active_ledger_sessions', (select count(*) from media_advice_private.sessions where not finished and expires_at > transaction_timestamp()),
  'active_or_queued_visible_m4_db_queries', (select count(*) from pg_stat_activity
    where pid <> pg_backend_pid() and datname = current_database() and state <> 'idle' and query ilike '%media_advice%'),
  'all_db_activity_visible', (select rolsuper from pg_roles where rolname = current_user)
    or pg_has_role(current_user, 'pg_read_all_stats', 'MEMBER'),
  'session_group_nullable', (select not a.attnotnull from pg_attribute a where a.attrelid = to_regclass('media_advice_private.sessions') and a.attname = 'group_id' and not a.attisdropped),
  'rpc_catalog', (select jsonb_agg(to_jsonb(r) order by signature) from rpcs r),
  'm4_triggers', coalesce((select jsonb_agg(to_jsonb(t) order by table_schema, table_name, trigger_name) from triggers t), '[]'::jsonb),
  'm4_tables', coalesce((select jsonb_agg(to_jsonb(o) order by table_name) from objects o), '[]'::jsonb),
  'data_comparison_fingerprints', (select jsonb_agg(to_jsonb(f) order by object_name) from fingerprints f)
) as preflight;

rollback;
