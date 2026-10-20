-- New feature only. Do not replay 001-016 or modify their historical RLS.
begin;
create schema media_advice_private;
revoke all on schema media_advice_private from public, anon, authenticated;
grant usage on schema media_advice_private to service_role;

create table media_advice_private.permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null check (feature_key = 'mykola_media_advice'),
  enabled boolean not null default false,
  expires_at timestamptz,
  primary key (user_id, feature_key)
);
create table media_advice_private.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  imdb_id text not null check (imdb_id ~ '^tt[0-9]{7,10}$'),
  list_id uuid references public.movie_group_lists(id) on delete cascade,
  form_session uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  attempts text[] not null default '{}',
  finished boolean not null default false,
  unique (user_id, form_session),
  check (cardinality(attempts) <= 8)
);
create index media_advice_sessions_user_created on media_advice_private.sessions(user_id, created_at);
alter table media_advice_private.permissions enable row level security;
alter table media_advice_private.sessions enable row level security;
revoke all on all tables in schema media_advice_private from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema media_advice_private to service_role;

-- Only the server's service role can call this function. p_user is obtained
-- from Auth getUser(token), never from the request body. Fresh DB checks also
-- apply before every reservation and before returning results.
create function public.media_advice_action(
  p_user uuid, p_group uuid, p_imdb text, p_list uuid, p_form uuid,
  p_op text, p_session uuid default null, p_stage text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_session media_advice_private.sessions%rowtype;
begin
  if p_user is null or p_group is null or p_form is null or p_imdb is null
     or p_imdb !~ '^tt[0-9]{7,10}$' then
    raise exception 'invalid-context' using errcode = '22023';
  end if;
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
  -- Short transaction only: never hold a lock across source I/O.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 4104));
  delete from media_advice_private.sessions where user_id = p_user and created_at < now() - interval '24 hours';
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
        and imdb_id = p_imdb and list_id is not distinct from p_list and form_session = p_form
      for update;
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
    else raise exception 'unsupported-action' using errcode = '22023';
    end if;
  end if;
  return jsonb_build_object('id', v_session.id, 'attempts', to_jsonb(v_session.attempts), 'cap', 8, 'expiresAt', v_session.expires_at);
end;
$$;
revoke all on function public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.media_advice_action(uuid,uuid,text,uuid,uuid,text,uuid,text) to service_role;

-- Invoke daily through an authorized operations path before activation.
-- No automatic production scheduler is installed by this migration.
create function public.media_advice_cleanup() returns bigint
language plpgsql security definer set search_path = ''
as $$
declare n bigint;
begin
  delete from media_advice_private.sessions where created_at < now() - interval '24 hours';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.media_advice_cleanup() from public, anon, authenticated;
grant execute on function public.media_advice_cleanup() to service_role;
comment on table media_advice_private.permissions is 'Поради носіїв від Миколи; backend-only per-user assignment, default off';
commit;
