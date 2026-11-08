-- Personal feature assignment + global discovery; no group/movie/editing gate
-- for reading advice. This PR migration is UNAPPLIED on the verified target.
-- Existing explicit flags/expiry and cap8/10/12/14 ledger rows are preserved.
begin;
set local lock_timeout = '5s';

-- Snapshot the OLD pilot scope before any mass feature assignment. The pilot
-- RPC historically treated this personal flag as its own permission, so simply
-- inserting Beta flags would otherwise also open the legacy pilot endpoint.
lock table auth.users, media_advice_private.beta_config, media_advice_private.user_regions,
  media_advice_private.permissions in share row exclusive mode;
create table media_advice_private.pilot_access_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table media_advice_private.pilot_access_users enable row level security;
revoke all on media_advice_private.pilot_access_users from public, anon, authenticated, service_role;
grant select on media_advice_private.pilot_access_users to service_role;
insert into media_advice_private.pilot_access_users(user_id)
  select user_id from media_advice_private.permissions where feature_key = 'mykola_media_advice';
comment on table media_advice_private.pilot_access_users is 'Preserved pre-autogrant pilot scope, not a Beta feature grant; separate explicit operator action required to expand the legacy pilot';

-- Track ONLY rows created by this automatic policy. Pre-existing rows are
-- explicit overrides (including false/expiry) and never enter this table.
create table media_advice_private.beta_feature_assignments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null
);
alter table media_advice_private.beta_feature_assignments enable row level security;
revoke all on media_advice_private.beta_feature_assignments from public, anon, authenticated, service_role;
grant select on media_advice_private.beta_feature_assignments to service_role;

-- Serialize region writes with Beta activation BEFORE either statement takes
-- row locks. Otherwise activation and a simultaneous signup could both miss
-- the other's uncommitted row and leave that eligible user without a grant.
-- Statement-level ordering also avoids the row-lock/advisory-lock inversion
-- of BEFORE ROW serialization. No lock is held across source HTTP.
create function media_advice_private.lock_beta_feature_assignment()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('media-advice-feature-assignment', 4104));
  return null;
end;
$$;
revoke all on function media_advice_private.lock_beta_feature_assignment() from public, anon, authenticated, service_role;
create trigger media_advice_lock_beta_feature_region
  before insert or update or delete on media_advice_private.user_regions
  for each statement execute function media_advice_private.lock_beta_feature_assignment();
create trigger media_advice_lock_beta_feature_activation
  before insert or update or delete on media_advice_private.beta_config
  for each statement execute function media_advice_private.lock_beta_feature_assignment();
-- Manual permission writes and Auth deletion cascades take the same lock
-- before touching permission/region rows, avoiding inverted mixed-write order.
create trigger media_advice_lock_beta_feature_permission
  before insert or update or delete on media_advice_private.permissions
  for each statement execute function media_advice_private.lock_beta_feature_assignment();
create trigger media_advice_lock_beta_feature_user_delete
  before delete on auth.users
  for each statement execute function media_advice_private.lock_beta_feature_assignment();

-- ANY later operator update, even an unchanged value, takes ownership away
-- from the automatic policy. The reconciler explicitly reclaims only its own
-- writes afterwards; no caller-settable GUC or metadata marker is trusted.
create function media_advice_private.detach_beta_feature_assignment()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.feature_key = 'mykola_media_advice' then
    delete from media_advice_private.beta_feature_assignments where user_id = old.user_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function media_advice_private.detach_beta_feature_assignment() from public, anon, authenticated, service_role;
create trigger media_advice_detach_beta_feature_assignment
  before update or delete on media_advice_private.permissions
  for each row execute function media_advice_private.detach_beta_feature_assignment();

-- Beta gates the whole feature, while region changes manage automatic flags.
-- Beta off does not rewrite personal settings. Existing managed rows still
-- follow region during Beta off; missing grants require active Beta + UA.
create function media_advice_private.assign_beta_feature(p_user uuid default null)
returns bigint language plpgsql security invoker set search_path = ''
as $$
declare
  v_count bigint := 0;
  v_region record;
  v_permission media_advice_private.permissions%rowtype;
  v_managed boolean;
  v_inserted uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('media-advice-feature-assignment', 4104));
  for v_region in select r.user_id, r.region_code from media_advice_private.user_regions r
    where p_user is null or r.user_id = p_user order by r.user_id for update of r
  loop
    select * into v_permission from media_advice_private.permissions
      where user_id = v_region.user_id and feature_key = 'mykola_media_advice' for update;
    if found then
      select a.enabled into v_managed from media_advice_private.beta_feature_assignments a
        where a.user_id = v_region.user_id;
      if found and v_permission.enabled = v_managed and v_permission.expires_at is null then
        if v_permission.enabled is distinct from (v_region.region_code = 'UA') then
          update media_advice_private.permissions set enabled = (v_region.region_code = 'UA')
            where user_id = v_region.user_id and feature_key = 'mykola_media_advice';
          insert into media_advice_private.beta_feature_assignments(user_id, enabled)
            values(v_region.user_id, v_region.region_code = 'UA')
            on conflict(user_id) do update set enabled = excluded.enabled;
          v_count := v_count + 1;
        end if;
      elsif found then
        -- Defensive drift handling: never claim a changed personal setting.
        delete from media_advice_private.beta_feature_assignments where user_id = v_region.user_id;
      end if;
    elsif v_region.region_code = 'UA' and exists (
      select 1 from media_advice_private.beta_config where singleton and enabled
    ) then
      v_inserted := null;
      insert into media_advice_private.permissions(user_id, feature_key, enabled, expires_at)
        values(v_region.user_id, 'mykola_media_advice', true, null)
        on conflict(user_id, feature_key) do nothing returning user_id into v_inserted;
      if v_inserted is not null then
        insert into media_advice_private.beta_feature_assignments(user_id, enabled)
          values(v_inserted, true);
        v_count := v_count + 1;
      end if;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke all on function media_advice_private.assign_beta_feature(uuid) from public, anon, authenticated, service_role;

create function media_advice_private.assign_beta_feature_on_region()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_permission media_advice_private.permissions%rowtype;
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from auth.users where id = old.user_id) then return old; end if;
    -- Missing backend region disables an automatic flag as well. Preserve
    -- ownership so a later authoritative UA insertion can enable it again.
    -- Lock the personal row BEFORE checking ownership: an operator may have
    -- detached it while this region deletion was waiting for that row lock.
    select * into v_permission from media_advice_private.permissions
      where user_id = old.user_id and feature_key = 'mykola_media_advice' for update;
    if found and v_permission.expires_at is null and exists (
      select 1 from media_advice_private.beta_feature_assignments
      where user_id = old.user_id and enabled = v_permission.enabled
    ) then
      update media_advice_private.permissions set enabled = false
        where user_id = old.user_id and feature_key = 'mykola_media_advice';
      if found then
        insert into media_advice_private.beta_feature_assignments(user_id, enabled) values(old.user_id, false)
          on conflict(user_id) do update set enabled = false;
      end if;
    end if;
    return old;
  end if;
  perform media_advice_private.assign_beta_feature(new.user_id);
  return new;
end;
$$;
revoke all on function media_advice_private.assign_beta_feature_on_region() from public, anon, authenticated, service_role;
-- This runs AFTER the existing default-region function actually inserts UA.
-- It does not infer region or rely on ordering of separate auth.users triggers.
create trigger media_advice_assign_beta_feature_region
  after insert or update of region_code or delete on media_advice_private.user_regions
  for each row execute function media_advice_private.assign_beta_feature_on_region();

create function media_advice_private.assign_beta_feature_on_activation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.singleton and new.enabled then perform media_advice_private.assign_beta_feature(); end if;
  return new;
end;
$$;
revoke all on function media_advice_private.assign_beta_feature_on_activation() from public, anon, authenticated, service_role;
create trigger media_advice_assign_beta_feature_activation
  after insert or update of enabled on media_advice_private.beta_config
  for each row execute function media_advice_private.assign_beta_feature_on_activation();

-- Also covers users who already exist when this unapplied migration is run.
select media_advice_private.assign_beta_feature();

-- NULL is an honest global scope, not a fabricated group. Legacy RPCs require
-- non-NULL p_group and use equality, so cannot adopt these new global sessions.
alter table media_advice_private.sessions alter column group_id drop not null;

create function media_advice_private.assert_beta_feature_access(p_user uuid)
returns boolean language plpgsql security invoker set search_path = ''
as $$
begin
  if p_user is null then raise exception 'invalid-context' using errcode = '22023'; end if;
  if not exists (select 1 from media_advice_private.beta_config where singleton and enabled)
     or not exists (
       select 1 from media_advice_private.permissions p
       where p.user_id = p_user and p.feature_key = 'mykola_media_advice'
         and p.enabled and (p.expires_at is null or p.expires_at > clock_timestamp())
     )
  then raise exception 'access-denied' using errcode = '42501'; end if;
  return exists (
    select 1 from media_advice_private.permissions p
    where p.user_id = p_user and p.feature_key = 'mykola_media_advice_diagnostics'
      and p.enabled and (p.expires_at is null or p.expires_at > clock_timestamp())
  );
end;
$$;
revoke all on function media_advice_private.assert_beta_feature_access(uuid) from public, anon, authenticated, service_role;

-- Legacy Beta sessions and apply retain their old context/role checks, but
-- cannot bypass a revoked/expired personal feature permission either.
create or replace function media_advice_private.assert_beta_access(
  p_user uuid, p_group uuid, p_imdb text, p_list uuid
) returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_diagnostics boolean;
begin
  v_diagnostics := media_advice_private.assert_beta_feature_access(p_user);
  if not exists (
    select 1 from public.group_members m where m.user_id = p_user
      and m.group_id = p_group and m.role in ('owner', 'member')
  ) then raise exception 'access-denied' using errcode = '42501'; end if;
  if p_list is not null and not exists (
    select 1 from public.movie_group_lists l join public.movies m on m.id = l.movie_id
    where l.id = p_list and l.group_id = p_group and m.imdb_id = p_imdb
  ) then raise exception 'card-context-denied' using errcode = '42501'; end if;
  return v_diagnostics;
end;
$$;
revoke all on function media_advice_private.assert_beta_access(uuid,uuid,text,uuid) from public, anon, authenticated, service_role;

create function public.media_advice_beta_global_action(
  p_user uuid, p_imdb text, p_form uuid, p_op text,
  p_session uuid default null, p_stage text default null
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_session media_advice_private.sessions%rowtype;
  v_diagnostics boolean;
begin
  v_diagnostics := media_advice_private.assert_beta_feature_access(p_user);
  if p_op = 'capability' then
    return jsonb_build_object('mykola_media_advice', true, 'mykola_media_advice_diagnostics', v_diagnostics);
  end if;
  if p_form is null or p_imdb is null or p_imdb !~ '^tt[0-9]{7,10}$' then
    raise exception 'invalid-context' using errcode = '22023';
  end if;
  if p_op = 'start' and p_stage is distinct from 'global-predicted-card-v1' then
    raise exception 'unsupported-start-contract' using errcode = '22023';
  end if;
  -- Fresh authorization after waiting, before cleanup or ledger mutation.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 4104));
  v_diagnostics := media_advice_private.assert_beta_feature_access(p_user);
  delete from media_advice_private.sessions where user_id = p_user
    and created_at <= clock_timestamp() - interval '24 hours' and expires_at <= clock_timestamp();
  if p_op = 'start' then
    if exists (select 1 from media_advice_private.sessions where user_id = p_user and form_session = p_form) then
      raise exception 'form-attempt-already-used' using errcode = '23505';
    end if;
    insert into media_advice_private.sessions(user_id, group_id, imdb_id, list_id, form_session, source_cap)
      values(p_user, null, p_imdb, null, p_form, 14) returning * into v_session;
  else
    select * into v_session from media_advice_private.sessions
      where id = p_session and user_id = p_user and group_id is null and list_id is null
        and imdb_id = p_imdb and form_session = p_form for update;
    if not found or v_session.expires_at <= clock_timestamp() or v_session.finished then
      raise exception 'session-unavailable' using errcode = '42501';
    end if;
    if p_op = 'reserve' then
      if p_stage is null or p_stage <> all(array['tmdb-find','tmdb-details','tmdb-providers','motn-title','search-1','search-2','kinobaza-1','kinobaza-2','tmdb-person','kinobaza-person','search-3','kinobaza-3','kinobaza-predicted','kinobaza-person-predicted']) then
        raise exception 'unsupported-stage' using errcode = '22023';
      end if;
      if p_stage = any(v_session.attempts) or cardinality(v_session.attempts) >= v_session.source_cap then
        raise exception 'attempt-already-spent-or-budget' using errcode = '54000';
      end if;
      update media_advice_private.sessions set attempts = attempts || p_stage where id = v_session.id returning * into v_session;
    elsif p_op = 'finish' then
      update media_advice_private.sessions set finished = true where id = v_session.id returning * into v_session;
    else raise exception 'unsupported-action' using errcode = '22023';
    end if;
  end if;
  return jsonb_build_object('id', v_session.id, 'attempts', to_jsonb(v_session.attempts), 'cap', v_session.source_cap,
    'expiresAt', v_session.expires_at, 'mykola_media_advice', true, 'mykola_media_advice_diagnostics', v_diagnostics);
end;
$$;
revoke all on function public.media_advice_beta_global_action(uuid,text,uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.media_advice_beta_global_action(uuid,text,uuid,text,uuid,text) to service_role;
comment on function public.media_advice_beta_global_action(uuid,text,uuid,text,uuid,text) is 'Verified server Auth user only; active personal flag + global Beta switch, no runtime region/group/editing gate; cap14 global sessions isolated from legacy group sessions';

-- The historical pilot HTTP deployment cannot redact its raw result. Keep its
-- pre-autogrant allowlist, require the global kill switch and separate active
-- diagnostics entitlement. Modern ordinary advice does NOT require diagnostics.
create function media_advice_private.assert_pilot_access(p_user uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not media_advice_private.assert_beta_feature_access(p_user)
     or not exists (select 1 from media_advice_private.pilot_access_users where user_id = p_user)
  then raise exception 'access-denied' using errcode = '42501'; end if;
end;
$$;
revoke all on function media_advice_private.assert_pilot_access(uuid) from public, anon, authenticated, service_role;

-- Preserve the original pilot ledger, role/list checks and cap8, adding fresh
-- authorization at both existing authorization positions (including post-lock).
create or replace function public.media_advice_action(
  p_user uuid, p_group uuid, p_imdb text, p_list uuid, p_form uuid,
  p_op text, p_session uuid default null, p_stage text default null
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_session media_advice_private.sessions%rowtype;
begin
  if p_user is null or p_group is null or p_form is null or p_imdb is null
     or p_imdb !~ '^tt[0-9]{7,10}$' then
    raise exception 'invalid-context' using errcode = '22023';
  end if;
  perform media_advice_private.assert_pilot_access(p_user);
  if not exists (
    select 1 from media_advice_private.permissions p
    where p.user_id = p_user and p.feature_key = 'mykola_media_advice'
      and p.enabled and (p.expires_at is null or p.expires_at > now())
  ) or not exists (
    select 1 from public.group_members m where m.user_id = p_user
      and m.group_id = p_group and m.role in ('owner', 'member')
  ) then raise exception 'access-denied' using errcode = '42501'; end if;
  if p_list is not null and not exists (
    select 1 from public.movie_group_lists l join public.movies m on m.id = l.movie_id
    where l.id = p_list and l.group_id = p_group and m.imdb_id = p_imdb
  ) then raise exception 'card-context-denied' using errcode = '42501'; end if;
  if p_op = 'capability' then return '{"mykola_media_advice":true}'::jsonb; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 4104));
  perform media_advice_private.assert_pilot_access(p_user);
  if not exists (
    select 1 from media_advice_private.permissions p
    where p.user_id = p_user and p.feature_key = 'mykola_media_advice'
      and p.enabled and (p.expires_at is null or p.expires_at > clock_timestamp())
  ) or not exists (
    select 1 from public.group_members m where m.user_id = p_user
      and m.group_id = p_group and m.role in ('owner', 'member')
  ) then raise exception 'access-denied' using errcode = '42501'; end if;
  if p_list is not null and not exists (
    select 1 from public.movie_group_lists l join public.movies m on m.id = l.movie_id
    where l.id = p_list and l.group_id = p_group and m.imdb_id = p_imdb
  ) then raise exception 'card-context-denied' using errcode = '42501'; end if;
  delete from media_advice_private.sessions where user_id = p_user
    and created_at <= clock_timestamp() - interval '24 hours' and expires_at <= clock_timestamp();
  if p_op = 'start' then
    if exists (select 1 from media_advice_private.sessions where user_id = p_user and form_session = p_form) then
      raise exception 'form-attempt-already-used' using errcode = '23505';
    end if;
    if (select count(*) from media_advice_private.sessions where user_id = p_user) >= 20 then
      raise exception 'daily-session-cap' using errcode = '54000';
    end if;
    insert into media_advice_private.sessions(user_id, group_id, imdb_id, list_id, form_session)
      values(p_user, p_group, p_imdb, p_list, p_form) returning * into v_session;
  else
    select * into v_session from media_advice_private.sessions
      where id = p_session and user_id = p_user and group_id = p_group
        and imdb_id = p_imdb and list_id is not distinct from p_list and form_session = p_form for update;
    if not found or v_session.expires_at <= now() or v_session.finished then
      raise exception 'session-unavailable' using errcode = '42501';
    end if;
    if p_op = 'reserve' then
      if p_stage is null or p_stage <> all(array['tmdb-find','tmdb-details','tmdb-providers','motn-title','search-1','search-2','kinobaza-1','kinobaza-2']) then
        raise exception 'unsupported-stage' using errcode = '22023';
      end if;
      if p_stage = any(v_session.attempts) or cardinality(v_session.attempts) >= 8 then
        raise exception 'attempt-already-spent-or-budget' using errcode = '54000';
      end if;
      update media_advice_private.sessions set attempts = attempts || p_stage where id = v_session.id returning * into v_session;
    elsif p_op = 'finish' then
      update media_advice_private.sessions set finished = true where id = v_session.id returning * into v_session;
    else raise exception 'unsupported-action' using errcode = '22023'; end if;
  end if;
  return jsonb_build_object('id', v_session.id, 'attempts', to_jsonb(v_session.attempts), 'cap', 8, 'expiresAt', v_session.expires_at);
end;
$$;
revoke all on function public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text) to service_role;
commit;
