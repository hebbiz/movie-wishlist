-- Beta-only extension. Keep legacy pilot RPC and historical SQL/RLS unchanged.
-- No activation or diagnostics assignment occurs in this migration.
begin;

create table media_advice_private.user_regions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  region_code text not null default 'UA' check (region_code ~ '^[A-Z]{2}$')
);
create table media_advice_private.beta_config (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
alter table media_advice_private.user_regions enable row level security;
alter table media_advice_private.beta_config enable row level security;
revoke all on media_advice_private.user_regions, media_advice_private.beta_config from public, anon, authenticated, service_role;
grant select on media_advice_private.user_regions, media_advice_private.beta_config to service_role;
insert into media_advice_private.beta_config(singleton, enabled) values(true, false);

create function media_advice_private.set_default_user_region() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into media_advice_private.user_regions(user_id)
    values(new.id) on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke all on function media_advice_private.set_default_user_region() from public, anon, authenticated, service_role;
create trigger media_advice_set_default_region after insert on auth.users
  for each row execute function media_advice_private.set_default_user_region();

-- Install the trigger before the backfill, in the same transaction. Deliberately
-- no editable Auth metadata, public.profiles, location or IP lookup. The
-- no-overwrite operation preserves any explicit value in the region table.
insert into media_advice_private.user_regions(user_id)
  select id from auth.users on conflict(user_id) do nothing;

alter table media_advice_private.permissions drop constraint permissions_feature_key_check;
alter table media_advice_private.permissions add constraint permissions_feature_key_check
  check (feature_key in ('mykola_media_advice', 'mykola_media_advice_diagnostics'));

-- Private invoker helper: called only by the service-role-only definer RPC.
-- VOLATILE (the default) intentionally uses fresh READ COMMITTED snapshots;
-- do not change this to STABLE or cache these authorization decisions.
create function media_advice_private.assert_beta_access(
  p_user uuid, p_group uuid, p_imdb text, p_list uuid
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists (select 1 from media_advice_private.beta_config where singleton and enabled)
     or not exists (select 1 from media_advice_private.user_regions where user_id = p_user and region_code = 'UA')
     or not exists (
       select 1 from public.group_members m where m.user_id = p_user
         and m.group_id = p_group and m.role in ('owner', 'member')
     ) then raise exception 'access-denied' using errcode = '42501'; end if;
  if p_list is not null and not exists (
    select 1 from public.movie_group_lists l join public.movies m on m.id = l.movie_id
    where l.id = p_list and l.group_id = p_group and m.imdb_id = p_imdb
  ) then raise exception 'card-context-denied' using errcode = '42501'; end if;
  return exists (
    select 1 from media_advice_private.permissions p
    where p.user_id = p_user and p.feature_key = 'mykola_media_advice_diagnostics'
      and p.enabled and (p.expires_at is null or p.expires_at > clock_timestamp())
  );
end;
$$;
revoke all on function media_advice_private.assert_beta_access(uuid,uuid,text,uuid) from public, anon, authenticated, service_role;

create function public.media_advice_beta_action(
  p_user uuid, p_group uuid, p_imdb text, p_list uuid, p_form uuid,
  p_op text, p_session uuid default null, p_stage text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_session media_advice_private.sessions%rowtype;
  v_diagnostics boolean;
begin
  if p_user is null or p_group is null or p_form is null or p_imdb is null
     or p_imdb !~ '^tt[0-9]{7,10}$' then
    raise exception 'invalid-context' using errcode = '22023';
  end if;
  v_diagnostics := media_advice_private.assert_beta_access(p_user, p_group, p_imdb, p_list);
  if p_op = 'capability' then
    return jsonb_build_object('mykola_media_advice', true, 'mykola_media_advice_diagnostics', v_diagnostics);
  end if;
  -- Short transaction, never across external I/O. Reauthorize after waiting
  -- and BEFORE cleanup or any other ledger mutation.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 4104));
  v_diagnostics := media_advice_private.assert_beta_access(p_user, p_group, p_imdb, p_list);
  delete from media_advice_private.sessions where user_id = p_user
    and created_at <= clock_timestamp() - interval '24 hours' and expires_at <= clock_timestamp();
  if p_op = 'start' then
    if exists (select 1 from media_advice_private.sessions where user_id = p_user and form_session = p_form) then
      raise exception 'form-attempt-already-used' using errcode = '23505';
    end if;
    -- No user/day search-count quota. Per-form replay protection and the
    -- atomic eight-stage source-attempt cap remain unchanged.
    insert into media_advice_private.sessions(user_id, group_id, imdb_id, list_id, form_session)
      values(p_user, p_group, p_imdb, p_list, p_form) returning * into v_session;
  else
    select * into v_session from media_advice_private.sessions
      where id = p_session and user_id = p_user and group_id = p_group
        and imdb_id = p_imdb and list_id is not distinct from p_list and form_session = p_form
      for update;
    if not found or v_session.expires_at <= clock_timestamp() or v_session.finished then
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
    else raise exception 'unsupported-action' using errcode = '22023';
    end if;
  end if;
  return jsonb_build_object('id', v_session.id, 'attempts', to_jsonb(v_session.attempts), 'cap', 8,
    'expiresAt', v_session.expires_at, 'mykola_media_advice', true,
    'mykola_media_advice_diagnostics', v_diagnostics);
end;
$$;
revoke all on function public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text) to service_role;

comment on table media_advice_private.user_regions is 'Backend-controlled user region; UA default, not inferred location; no client self-grant';
comment on table media_advice_private.beta_config is 'Global Beta server switch, migration default off; legacy pilot RPC is unchanged';
commit;
