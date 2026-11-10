-- PREPARED ONLY; separate release/activation authorization is required.
-- psql -v ON_ERROR_STOP=1 -v verified_test_user_id=<independently-verified UUID>
-- Never infer this identity from a name, email, metadata, or first user row.
begin;
-- \gset consumes the return value locally instead of printing the user UUID.
select set_config('mw.m4_beta_verified_test_user_id', :'verified_test_user_id', true) as local_assignment_context \gset
do $$
declare
  v_user uuid := current_setting('mw.m4_beta_verified_test_user_id')::uuid;
begin
  -- The release operator must first verify the existing pilot assignment.
  -- Do not silently broaden diagnostics if the established baseline changed.
  if (select count(*) from media_advice_private.permissions
      where feature_key = 'mykola_media_advice' and enabled
        and (expires_at is null or expires_at > clock_timestamp())) <> 1
     or not exists (
       select 1 from media_advice_private.permissions p
       join auth.users u on u.id = p.user_id
       join media_advice_private.user_regions r on r.user_id = p.user_id
       where p.user_id = v_user and p.feature_key = 'mykola_media_advice'
         and p.enabled and (p.expires_at is null or p.expires_at > clock_timestamp())
         and r.region_code = 'UA'
     ) then raise exception 'verify-existing-pilot-assignment'; end if;
  if exists (
    select 1 from media_advice_private.permissions
    where feature_key = 'mykola_media_advice_diagnostics'
      and user_id <> v_user and enabled
      and (expires_at is null or expires_at > clock_timestamp())
  ) then raise exception 'review-other-diagnostics-assignments'; end if;
  if not exists (select 1 from media_advice_private.beta_config where singleton and not enabled)
  then raise exception 'review-current-beta-switch'; end if;

  insert into media_advice_private.permissions(user_id, feature_key, enabled, expires_at)
    select user_id, 'mykola_media_advice_diagnostics', true, expires_at
    from media_advice_private.permissions
    where user_id = v_user and feature_key = 'mykola_media_advice'
    on conflict(user_id, feature_key) do update
      set enabled = excluded.enabled, expires_at = excluded.expires_at;
  update media_advice_private.beta_config set enabled = true where singleton;
end;
$$;
commit;
