/*
===============================================================================
 Movie Wishlist 1.2 — Production Database Snapshot
 Version: 1.2.0
 Date: September 2026

 Purpose
 -------
 Documents the production PostgreSQL/Supabase database structure used by
 Movie Wishlist at the 1.2 release milestone.

 This is an architectural snapshot, not a complete standalone migration.

 It intentionally excludes:
 - user/application data
 - auth.users data
 - Vault secret values
 - API keys
 - VAPID private keys
 - Supabase service-role credentials

 External Supabase dependencies:
 - Supabase Auth
 - Supabase Vault
 - Edge Function: send-movie-activity-push

 All public application tables have Row Level Security enabled.
 FORCE ROW LEVEL SECURITY is not enabled.
===============================================================================
*/


-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

-- Production versions observed at release:
-- pg_cron   1.6.4  (pg_catalog)
-- pg_net    0.20.4 (extensions)
-- pgcrypto  1.3    (extensions)
-- uuid-ossp 1.1    (extensions)

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;


-- ============================================================================
-- 2. TABLES
-- ============================================================================

create table public.movies (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  year integer,
  imdb_url text,
  poster_url text,
  notes text,
  imdb_id text not null,

  constraint movies_pkey primary key (id),
  constraint movies_imdb_id_unique unique (imdb_id),
  constraint movies_imdb_id_format
    check (imdb_id ~ '^tt[0-9]+$'::text)
);


create table public.profiles (
  id uuid not null,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  notifications_enabled boolean not null default false,

  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey
    foreign key (id)
    references auth.users(id)
    on delete cascade
);


create table public.groups (
  id uuid not null default gen_random_uuid(),
  name text not null,
  type text not null default 'family'::text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid,

  constraint groups_pkey primary key (id),
  constraint groups_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
);


create table public.group_members (
  id uuid not null default gen_random_uuid(),
  group_id uuid not null,
  user_id uuid not null,
  role text not null default 'member'::text,
  created_at timestamptz not null default now(),
  is_group_subscriber boolean not null default false,

  constraint group_members_pkey primary key (id),
  constraint group_members_group_id_fkey
    foreign key (group_id)
    references public.groups(id)
    on delete cascade,
  constraint group_members_user_id_fkey
    foreign key (user_id)
    references public.profiles(id)
    on delete cascade,
  constraint group_members_group_id_user_id_key
    unique (group_id, user_id)
);


create table public.invitations (
  id uuid not null default gen_random_uuid(),
  group_id uuid not null,
  role text not null,
  token text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_by uuid,
  used_at timestamptz,
  email text not null,

  constraint invitations_pkey primary key (id),
  constraint invitations_group_id_fkey
    foreign key (group_id)
    references public.groups(id)
    on delete cascade,
  constraint invitations_created_by_fkey
    foreign key (created_by)
    references public.profiles(id),
  constraint invitations_used_by_fkey
    foreign key (used_by)
    references public.profiles(id),
  constraint invitations_token_key unique (token),
  constraint invitations_role_check
    check (role = any (array['member'::text, 'visitor'::text]))
);


create table public.movie_group_lists (
  id uuid not null default gen_random_uuid(),
  movie_id uuid not null,
  group_id uuid not null,
  status text not null default 'wishlist'::text,
  recommended_medium text,
  owned_medium text,
  purchase_url text,
  added_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint movie_group_lists_pkey primary key (id),
  constraint movie_group_lists_movie_id_fkey
    foreign key (movie_id)
    references public.movies(id)
    on delete cascade,
  constraint movie_group_lists_group_id_fkey
    foreign key (group_id)
    references public.groups(id)
    on delete cascade,
  constraint movie_group_lists_movie_id_group_id_key
    unique (movie_id, group_id)
);


create table public.recommendations (
  id uuid not null default gen_random_uuid(),
  movie_id uuid not null,
  user_id uuid not null,
  context_group_id uuid not null,
  created_at timestamptz not null default now(),
  comment text,
  rating_value numeric,

  constraint recommendations_pkey primary key (id),
  constraint recommendations_movie_id_fkey
    foreign key (movie_id)
    references public.movies(id)
    on delete cascade,
  constraint recommendations_user_id_fkey
    foreign key (user_id)
    references public.profiles(id)
    on delete cascade,
  constraint recommendations_context_group_id_fkey
    foreign key (context_group_id)
    references public.groups(id)
    on delete cascade,
  constraint recommendations_movie_id_user_id_key
    unique (movie_id, user_id),
  constraint recommendations_rating_value_check
    check (
      rating_value is null
      or (rating_value >= 1::numeric and rating_value <= 20::numeric)
    )
);


create table public.advice_rooms (
  id uuid not null default gen_random_uuid(),
  movie_id uuid not null,
  group_id uuid not null,
  created_by uuid not null,
  status text not null,
  opened_at timestamptz not null default now(),
  expires_at timestamptz,
  closed_at timestamptz,
  result_generated boolean not null default false,

  constraint advice_rooms_pkey primary key (id),
  constraint advice_rooms_movie_id_fkey
    foreign key (movie_id)
    references public.movies(id)
    on delete cascade,
  constraint advice_rooms_group_id_fkey
    foreign key (group_id)
    references public.groups(id)
    on delete cascade,
  constraint advice_rooms_created_by_fkey
    foreign key (created_by)
    references auth.users(id),
  constraint advice_rooms_status_check
    check (
      status = any (
        array[
          'waiting'::text,
          'discussion'::text,
          'summarizing'::text,
          'closed'::text
        ]
      )
    )
);


create table public.advice_room_participants (
  id uuid not null default gen_random_uuid(),
  room_id uuid not null,
  user_id uuid not null,
  status text not null,
  joined_at timestamptz not null default now(),
  finished_at timestamptz,
  last_seen_at timestamptz not null default now(),
  submitted_at timestamptz,

  constraint advice_room_participants_pkey primary key (id),
  constraint advice_room_participants_room_id_fkey
    foreign key (room_id)
    references public.advice_rooms(id)
    on delete cascade,
  constraint advice_room_participants_user_id_fkey
    foreign key (user_id)
    references auth.users(id),
  constraint advice_room_participants_status_check
    check (
      status = any (
        array[
          'active'::text,
          'finished'::text,
          'left'::text
        ]
      )
    )
);


create table public.push_subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  expiration_time bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint push_subscriptions_pkey primary key (id),
  constraint push_subscriptions_user_id_fkey
    foreign key (user_id)
    references auth.users(id)
    on delete cascade,
  constraint push_subscriptions_endpoint_key
    unique (endpoint)
);


create table public.movie_activity (
  id uuid not null default gen_random_uuid(),
  group_id uuid not null,
  movie_id uuid not null,
  actor_user_id uuid not null,
  activity_category text not null default 'catalog_status'::text,
  from_status text,
  to_status text not null,
  created_at timestamptz not null default now(),

  constraint movie_activity_pkey primary key (id),
  constraint movie_activity_group_id_fkey
    foreign key (group_id)
    references public.groups(id)
    on delete cascade,
  constraint movie_activity_movie_id_fkey
    foreign key (movie_id)
    references public.movies(id)
    on delete cascade,
  constraint movie_activity_actor_user_id_fkey
    foreign key (actor_user_id)
    references public.profiles(id)
    on delete cascade,
  constraint movie_activity_current_event_unique
    unique (group_id, movie_id, activity_category)
);


create table public.movie_activity_recipients (
  activity_id uuid not null,
  user_id uuid not null,
  seen_at timestamptz,

  constraint movie_activity_recipients_pkey
    primary key (activity_id, user_id),
  constraint movie_activity_recipients_activity_id_fkey
    foreign key (activity_id)
    references public.movie_activity(id)
    on delete cascade,
  constraint movie_activity_recipients_user_id_fkey
    foreign key (user_id)
    references public.profiles(id)
    on delete cascade
);


-- ============================================================================
-- 3. INDEXES
-- ============================================================================
-- PK/UNIQUE backing indexes generated by PostgreSQL are not repeated here.

create unique index advice_room_unique_user
  on public.advice_room_participants using btree (room_id, user_id);

create index advice_rooms_lookup_idx
  on public.advice_rooms using btree (group_id, movie_id, status);

create index invitations_group_id_idx
  on public.invitations using btree (group_id);

create index invitations_token_idx
  on public.invitations using btree (token);

create unique index movie_group_lists_group_movie_unique
  on public.movie_group_lists using btree (group_id, movie_id);

create index push_subscriptions_user_id_idx
  on public.push_subscriptions using btree (user_id);

create index movie_activity_created_at_idx
  on public.movie_activity using btree (created_at);

create index movie_activity_group_status_idx
  on public.movie_activity using btree (group_id, to_status);

create index movie_activity_recipients_unseen_user_idx
  on public.movie_activity_recipients using btree (user_id, activity_id)
  where seen_at is null;


-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

alter table public.advice_room_participants enable row level security;
alter table public.advice_rooms enable row level security;
alter table public.group_members enable row level security;
alter table public.groups enable row level security;
alter table public.invitations enable row level security;
alter table public.movie_activity enable row level security;
alter table public.movie_activity_recipients enable row level security;
alter table public.movie_group_lists enable row level security;
alter table public.movies enable row level security;
alter table public.profiles enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.recommendations enable row level security;


-- ============================================================================
-- 5. FUNCTIONS
-- ============================================================================

create or replace function public.current_user_group_role(target_group_id uuid)
returns text
language sql
security definer
set search_path to 'public'
as $function$
  select role
  from public.group_members
  where group_id = target_group_id
    and user_id = auth.uid()
  limit 1;
$function$;


create or replace function public.can_read_recommendation(
  recommendation_user_id uuid,
  recommendation_group_id uuid
)
returns boolean
language sql
security definer
set search_path to 'public'
as $function$
  select
    recommendation_user_id = auth.uid()

    or exists (
      select 1
      from public.group_members me
      join public.group_members shared_user
        on shared_user.group_id = me.group_id
      where me.user_id = auth.uid()
        and shared_user.user_id = recommendation_user_id
    )

    or exists (
      select 1
      from public.group_members me
      join public.group_members shared_user
        on shared_user.group_id = me.group_id
      join public.group_members shared_user_groups
        on shared_user_groups.user_id = shared_user.user_id
      join public.group_members second_level_user
        on second_level_user.group_id = shared_user_groups.group_id
      where me.user_id = auth.uid()
        and second_level_user.user_id = recommendation_user_id
    );
$function$;


create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  default_group_id uuid;
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;

  select id
  into default_group_id
  from public.groups
  where is_default = true
  limit 1;

  if default_group_id is not null then
    insert into public.group_members (group_id, user_id, role)
    values (default_group_id, new.id, 'visitor')
    on conflict (group_id, user_id) do nothing;
  end if;

  return new;
end;
$function$;


create or replace function public.enter_advice_room(
  p_movie_id uuid,
  p_group_id uuid
)
returns table(
  result_room_id uuid,
  result_room_status text,
  result_participant_count integer,
  result_room_expires_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room advice_rooms;
  v_count integer;
begin
  select ar.*
  into v_room
  from advice_rooms ar
  where ar.movie_id = p_movie_id
    and ar.group_id = p_group_id
    and (
      ar.status = 'waiting'
      or (
        ar.status = 'discussion'
        and ar.expires_at > now()
      )
    )
  order by ar.opened_at desc
  limit 1;

  if v_room.id is null then
    insert into advice_rooms (
      movie_id,
      group_id,
      created_by,
      status,
      expires_at
    )
    values (
      p_movie_id,
      p_group_id,
      auth.uid(),
      'waiting',
      'infinity'::timestamptz
    )
    returning * into v_room;
  end if;

  insert into advice_room_participants (
    room_id,
    user_id,
    status,
    last_seen_at
  )
  values (
    v_room.id,
    auth.uid(),
    'active',
    now()
  )
  on conflict (room_id, user_id)
  do update set
    status = 'active',
    last_seen_at = now(),
    finished_at = null;

  select count(*)
  into v_count
  from advice_room_participants arp
  where arp.room_id = v_room.id
    and arp.status in ('active', 'finished');

  if v_count > 1 and v_room.status = 'waiting' then
    update advice_rooms ar
    set
      status = 'discussion',
      expires_at = now() + interval '3 minutes'
    where ar.id = v_room.id
    returning ar.* into v_room;
  end if;

  return query
  select
    v_room.id,
    v_room.status::text,
    v_count,
    v_room.expires_at;
end;
$function$;


create or replace function public.finish_advice_room(p_room_id uuid)
returns table(
  result_room_id uuid,
  result_participant_count integer,
  result_finished_count integer,
  result_is_complete boolean
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_participant_count integer;
  v_finished_count integer;
  v_is_complete boolean;
begin
  update advice_room_participants
  set
    status = 'finished',
    finished_at = coalesce(finished_at, now()),
    last_seen_at = now(),
    submitted_at = coalesce(submitted_at, now())
  where room_id = p_room_id
    and user_id = auth.uid()
    and status in ('active', 'finished');

  select
    count(*) filter (
      where
        status in ('active', 'finished')
        or submitted_at is not null
    )::integer,

    count(*) filter (
      where submitted_at is not null
    )::integer
  into
    v_participant_count,
    v_finished_count
  from advice_room_participants
  where room_id = p_room_id;

  v_is_complete :=
    v_participant_count > 0
    and v_participant_count = v_finished_count;

  if v_is_complete then
    update advice_rooms
    set status = 'summarizing'
    where id = p_room_id
      and status in ('waiting', 'discussion');
  end if;

  return query
  select
    p_room_id,
    v_participant_count,
    v_finished_count,
    v_is_complete;
end;
$function$;


create or replace function public.get_advice_room_state(p_room_id uuid)
returns table(
  result_room_id uuid,
  result_room_status text,
  result_participant_count integer,
  result_finished_count integer,
  result_is_complete boolean
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room advice_rooms;
  v_participant_count integer;
  v_finished_count integer;
  v_is_complete boolean;
begin
  select ar.*
  into v_room
  from advice_rooms ar
  where ar.id = p_room_id;

  if v_room.id is null then
    return;
  end if;

  select
    count(*) filter (
      where
        arp.status in ('active', 'finished')
        or arp.submitted_at is not null
    )::integer,

    count(*) filter (
      where arp.submitted_at is not null
    )::integer
  into
    v_participant_count,
    v_finished_count
  from advice_room_participants arp
  where arp.room_id = p_room_id;

  v_is_complete :=
    v_participant_count > 0
    and (
      v_finished_count = v_participant_count
      or v_room.expires_at <= now()
      or v_room.status = 'closed'
    );

  if v_is_complete and v_room.status <> 'closed' then
    update advice_rooms ar
    set
      status = 'closed',
      closed_at = coalesce(ar.closed_at, now()),
      result_generated = true
    where ar.id = p_room_id
    returning ar.* into v_room;
  end if;

  return query
  select
    v_room.id,
    v_room.status::text,
    v_participant_count,
    v_finished_count,
    v_is_complete;
end;
$function$;


create or replace function public.leave_advice_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_has_present_participants boolean;
begin
  update advice_room_participants arp
  set
    status = 'left',
    last_seen_at = now()
  where arp.room_id = p_room_id
    and arp.user_id = auth.uid()
    and arp.status in ('active', 'finished');

  v_has_present_participants := exists (
    select 1
    from advice_room_participants arp
    where arp.room_id = p_room_id
      and arp.status in ('active', 'finished')
  );

  if not v_has_present_participants then
    delete from advice_rooms
    where id = p_room_id;
  end if;
end;
$function$;


create or replace function public.replace_movie_catalog_activity(
  p_group_id uuid,
  p_movie_id uuid,
  p_actor_user_id uuid,
  p_from_status text,
  p_to_status text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_activity_id uuid;
  v_recipient_count integer;
begin
  if p_group_id is null
     or p_movie_id is null
     or p_actor_user_id is null
     or p_to_status is null then
    raise exception
      'Movie activity requires group_id, movie_id, actor_user_id and to_status';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_actor_user_id
  ) then
    raise exception 'Actor is not a member of this group';
  end if;

  if not exists (
    select 1
    from public.movie_group_lists mgl
    where mgl.group_id = p_group_id
      and mgl.movie_id = p_movie_id
  ) then
    raise exception 'Movie is not present in this group';
  end if;

  delete from public.movie_activity
  where group_id = p_group_id
    and movie_id = p_movie_id
    and activity_category = 'catalog_status';

  insert into public.movie_activity (
    group_id,
    movie_id,
    actor_user_id,
    activity_category,
    from_status,
    to_status,
    created_at
  )
  values (
    p_group_id,
    p_movie_id,
    p_actor_user_id,
    'catalog_status',
    p_from_status,
    p_to_status,
    now()
  )
  returning id into v_activity_id;

  insert into public.movie_activity_recipients (
    activity_id,
    user_id,
    seen_at
  )
  select
    v_activity_id,
    gm.user_id,
    null
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.user_id <> p_actor_user_id;

  get diagnostics v_recipient_count = row_count;

  if v_recipient_count = 0 then
    delete from public.movie_activity
    where id = v_activity_id;

    return null;
  end if;

  return v_activity_id;
end;
$function$;


create or replace function public.handle_movie_group_list_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor_user_id uuid;
begin
  v_actor_user_id := auth.uid();

  if v_actor_user_id is null then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    perform public.replace_movie_catalog_activity(
      new.group_id,
      new.movie_id,
      v_actor_user_id,
      null,
      new.status
    );

    return new;
  end if;

  if TG_OP = 'UPDATE'
     and old.status is distinct from new.status then
    perform public.replace_movie_catalog_activity(
      new.group_id,
      new.movie_id,
      v_actor_user_id,
      old.status,
      new.status
    );
  end if;

  return new;
end;
$function$;


create or replace function public.mark_movie_activity_seen(
  p_activity_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.movie_activity_recipients
  set seen_at = coalesce(seen_at, now())
  where activity_id = p_activity_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Activity is not assigned to current user';
  end if;

  if not exists (
    select 1
    from public.movie_activity_recipients
    where activity_id = p_activity_id
      and seen_at is null
  ) then
    delete from public.movie_activity
    where id = p_activity_id;
  end if;
end;
$function$;


create or replace function public.cleanup_old_movie_activity()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  deleted_count integer;
begin
  delete from public.movie_activity
  where created_at < now() - interval '30 days';

  get diagnostics deleted_count = row_count;

  return deleted_count;
end;
$function$;


create or replace function public.notify_movie_activity_push()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  edge_secret text;
  function_url text;
begin
  select decrypted_secret
  into edge_secret
  from vault.decrypted_secrets
  where name = 'movie_wishlist_edge_secret'
  limit 1;

  if edge_secret is null then
    raise warning 'movie_wishlist_edge_secret not found';
    return new;
  end if;

  function_url :=
    'https://mttkectgdqqmejpenkrn.supabase.co/functions/v1/send-movie-activity-push';

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', edge_secret
    ),
    body := jsonb_build_object(
      'activity_id', new.id
    )
  );

  return new;
end;
$function$;


-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

create policy "advice_room_participants_select"
on public.advice_room_participants
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.advice_rooms r
    join public.group_members gm
      on gm.group_id = r.group_id
    where r.id = advice_room_participants.room_id
      and gm.user_id = auth.uid()
  )
);


create policy "advice_rooms_select"
on public.advice_rooms
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = advice_rooms.group_id
      and gm.user_id = auth.uid()
  )
);


create policy "Owners can remove group members"
on public.group_members
as permissive
for delete
to authenticated
using (
  role <> 'owner'::text
  and exists (
    select 1
    from public.group_members owner_membership
    where owner_membership.group_id = group_members.group_id
      and owner_membership.user_id = auth.uid()
      and owner_membership.role = 'owner'::text
  )
);


create policy "Users can accept their own invitations"
on public.group_members
as permissive
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.invitations i
    where i.group_id = group_members.group_id
      and lower(i.email) = lower(auth.jwt() ->> 'email'::text)
      and i.role = group_members.role
  )
);


create policy "Users can create owner membership for own groups"
on public.group_members
as permissive
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'::text
  and exists (
    select 1
    from public.groups g
    where g.id = group_members.group_id
      and g.created_by = auth.uid()
  )
);


create policy "Users can read own group membership"
on public.group_members
as permissive
for select
to authenticated
using (user_id = auth.uid());


create policy "Users can subscribe to connected users groups as visitor"
on public.group_members
as permissive
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'visitor'::text
  and is_group_subscriber = true
  and exists (
    select 1
    from public.groups target_group
    where target_group.id = group_members.group_id
      and target_group.created_by <> auth.uid()
      and exists (
        select 1
        from public.group_members my_membership
        join public.group_members connected_membership
          on connected_membership.group_id = my_membership.group_id
        where my_membership.user_id = auth.uid()
          and connected_membership.user_id = target_group.created_by
          and connected_membership.user_id <> auth.uid()
      )
  )
);


create policy "group_members_select"
on public.group_members
as permissive
for select
to authenticated
using (
  current_user_group_role(group_id)
    = any (array['owner'::text, 'member'::text])
  or user_id = auth.uid()
);


create policy "Authenticated users can create groups"
on public.groups
as permissive
for insert
to authenticated
with check (created_by = auth.uid());


create policy "Group members can read their groups"
on public.groups
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = groups.id
      and gm.user_id = auth.uid()
  )
);


create policy "Users can read groups created by shared group members"
on public.groups
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.group_members my_membership
    join public.group_members connected_membership
      on connected_membership.group_id = my_membership.group_id
    where my_membership.user_id = auth.uid()
      and connected_membership.user_id = groups.created_by
      and connected_membership.user_id <> auth.uid()
  )
);


create policy "Users can read groups they created"
on public.groups
as permissive
for select
to authenticated
using (created_by = auth.uid());


create policy "groups_select_visible_recommendation_contexts"
on public.groups
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.recommendations r
    where r.context_group_id = groups.id
      and can_read_recommendation(r.user_id, r.context_group_id)
  )
);


create policy "Authenticated users can read invitations"
on public.invitations
as permissive
for select
to authenticated
using (true);


create policy "Owners can create invitations"
on public.invitations
as permissive
for insert
to public
with check (
  exists (
    select 1
    from public.group_members
    where group_members.group_id = invitations.group_id
      and group_members.user_id = auth.uid()
      and group_members.role = 'owner'::text
  )
);


create policy "Users can delete used invitations for their email"
on public.invitations
as permissive
for delete
to authenticated
using (
  lower(email) = lower(auth.jwt() ->> 'email'::text)
);


create policy "Users can read invitations for their email"
on public.invitations
as permissive
for select
to authenticated
using (
  lower(email) = lower(auth.jwt() ->> 'email'::text)
);


create policy "movie_activity_select_assigned"
on public.movie_activity
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.movie_activity_recipients mar
    where mar.activity_id = movie_activity.id
      and mar.user_id = (select auth.uid() as uid)
  )
);


create policy "movie_activity_recipients_select_own"
on public.movie_activity_recipients
as permissive
for select
to authenticated
using (
  user_id = (select auth.uid() as uid)
);


create policy "Members can delete movie group lists"
on public.movie_group_lists
as permissive
for delete
to authenticated
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = movie_group_lists.group_id
      and gm.user_id = auth.uid()
  )
);


create policy "Members can insert movie group lists"
on public.movie_group_lists
as permissive
for insert
to authenticated
with check (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = movie_group_lists.group_id
      and gm.user_id = auth.uid()
  )
);


create policy "Members can update movie group lists"
on public.movie_group_lists
as permissive
for update
to authenticated
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = movie_group_lists.group_id
      and gm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = movie_group_lists.group_id
      and gm.user_id = auth.uid()
  )
);


create policy "Users can count movie lists in socially connected groups"
on public.movie_group_lists
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.groups target_group
    where target_group.id = movie_group_lists.group_id
      and target_group.created_by <> auth.uid()
      and exists (
        select 1
        from public.group_members my_membership
        join public.group_members connected_membership
          on connected_membership.group_id = my_membership.group_id
        where my_membership.user_id = auth.uid()
          and connected_membership.user_id = target_group.created_by
          and connected_membership.user_id <> auth.uid()
      )
  )
);


create policy "Users can read own group lists"
on public.movie_group_lists
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = movie_group_lists.group_id
      and gm.user_id = auth.uid()
  )
);


create policy "Allow public delete"
on public.movies
as permissive
for delete
to public
using (true);


create policy "Allow public insert"
on public.movies
as permissive
for insert
to public
with check (true);


create policy "Allow public read"
on public.movies
as permissive
for select
to public
using (true);


create policy "Allow public update"
on public.movies
as permissive
for update
to public
using (true)
with check (true);


create policy "Users can read their own profile"
on public.profiles
as permissive
for select
to authenticated
using (auth.uid() = id);


create policy "Users can update their own profile"
on public.profiles
as permissive
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);


create policy "profiles_select_visible_group_members"
on public.profiles
as permissive
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.group_members gm_target
    where gm_target.user_id = profiles.id
      and current_user_group_role(gm_target.group_id)
        = any (array['owner'::text, 'member'::text])
  )
);


create policy "profiles_select_visible_recommendation_users"
on public.profiles
as permissive
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.recommendations r
    where r.user_id = profiles.id
      and can_read_recommendation(r.user_id, r.context_group_id)
  )
);


create policy "Users can delete own push subscriptions"
on public.push_subscriptions
as permissive
for delete
to authenticated
using (user_id = auth.uid());


create policy "Users can insert own push subscriptions"
on public.push_subscriptions
as permissive
for insert
to authenticated
with check (user_id = auth.uid());


create policy "Users can read own push subscriptions"
on public.push_subscriptions
as permissive
for select
to authenticated
using (user_id = auth.uid());


create policy "Users can update own push subscriptions"
on public.push_subscriptions
as permissive
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());


create policy "Users can create own recommendations in available group"
on public.recommendations
as permissive
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.group_members gm
    where gm.group_id = recommendations.context_group_id
      and gm.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.movie_group_lists mgl
    where mgl.group_id = recommendations.context_group_id
      and mgl.movie_id = recommendations.movie_id
  )
);


create policy "Users can delete own recommendations"
on public.recommendations
as permissive
for delete
to authenticated
using (user_id = auth.uid());


create policy "Users can read own recommendations"
on public.recommendations
as permissive
for select
to authenticated
using (user_id = auth.uid());


create policy "Users can read socially visible recommendations"
on public.recommendations
as permissive
for select
to authenticated
using (
  can_read_recommendation(user_id, context_group_id)
);


create policy "Users can update own recommendations"
on public.recommendations
as permissive
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


create trigger trg_movie_activity_push
after insert on public.movie_activity
for each row
execute function public.notify_movie_activity_push();


create trigger trg_movie_group_list_activity
after insert or update of status
on public.movie_group_lists
for each row
execute function public.handle_movie_group_list_activity();


-- ============================================================================
-- 8. CRON
-- ============================================================================

-- Production job at Movie Wishlist 1.2 release:
--
-- jobname:  cleanup-old-movie-activity
-- schedule: 15 3 * * *
-- active:   true
--
-- Deletes Movie Activity records older than 30 days.
-- Recipient rows are removed through ON DELETE CASCADE.

select cron.schedule(
  'cleanup-old-movie-activity',
  '15 3 * * *',
  $$
    select public.cleanup_old_movie_activity();
  $$
);


-- ============================================================================
-- 9. EXTERNAL / SECRET-BASED DEPENDENCIES
-- ============================================================================

-- notify_movie_activity_push() expects a Supabase Vault secret named:
--
--   movie_wishlist_edge_secret
--
-- The secret VALUE is intentionally not included in this repository.
--
-- The function calls the deployed Supabase Edge Function:
--
--   send-movie-activity-push
--
-- Edge Function source/configuration and the PWA notification flow are
-- documented separately in architecture.md.
--
-- This snapshot contains no application rows, auth users, push endpoint
-- values, Vault secret values, or private credentials.


-- ============================================================================
-- END OF MOVIE WISHLIST 1.2 DATABASE SNAPSHOT
-- ============================================================================
