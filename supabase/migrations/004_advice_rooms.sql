-- Create advice rooms table

create table advice_rooms (
    id uuid primary key default gen_random_uuid(),

    movie_id uuid not null
        references movies(id)
        on delete cascade,

    group_id uuid not null
        references groups(id)
        on delete cascade,

    created_by uuid not null
        references auth.users(id),

    status text not null
        check (status in ('waiting','discussion','summarizing','closed')),

    opened_at timestamptz not null default now(),

    expires_at timestamptz not null,

    closed_at timestamptz,

    result_generated boolean not null default false
);

-- Add index to advice_rooms

create index advice_rooms_lookup_idx
on advice_rooms(group_id,movie_id,status);

-- Add advice_room_participants table

create table advice_room_participants (

    id uuid primary key default gen_random_uuid(),

    room_id uuid not null
        references advice_rooms(id)
        on delete cascade,

    user_id uuid not null
        references auth.users(id),

    status text not null
        check (status in ('active','finished','left')),

    joined_at timestamptz not null default now(),

    finished_at timestamptz,

    last_seen_at timestamptz not null default now()
);

-- Ensure no duplicates in advice_room_participants

create unique index advice_room_unique_user
on advice_room_participants(room_id,user_id);

-- Comment on tables

comment on table advice_rooms
is 'Temporary collaborative recommendation room';

comment on table advice_room_participants
is 'Participants of collaborative recommendation rooms';

-- Add RPC function - Enter advice room

create or replace function enter_advice_room(
  p_movie_id uuid,
  p_group_id uuid
)
returns table (
  room_id uuid,
  room_status text,
  participant_count integer,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room advice_rooms;
  v_count integer;
begin
  select *
  into v_room
  from advice_rooms
  where movie_id = p_movie_id
    and group_id = p_group_id
    and status in ('waiting', 'discussion')
    and expires_at > now()
  order by opened_at desc
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
      now() + interval '1 minute'
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
  from advice_room_participants
  where room_id = v_room.id
    and status = 'active';

  if v_count > 1 and v_room.status = 'waiting' then
    update advice_rooms
    set status = 'discussion'
    where id = v_room.id
    returning * into v_room;
  end if;

  return query
  select
    v_room.id,
    v_room.status,
    v_count,
    v_room.expires_at;
end;
$$;

-- Lets authenticated user use RPC function to enter advice room

grant execute on function enter_advice_room(uuid, uuid) to authenticated;

-- Add policy to read advice room

create policy advice_rooms_select
on advice_rooms
for select
to authenticated
using (
    exists (
        select 1
        from group_members gm
        where gm.group_id = advice_rooms.group_id
          and gm.user_id = auth.uid()
    )
);

-- Add policy to read advice room participants

create policy advice_room_participants_select
on advice_room_participants
for select
to authenticated
using (
    exists (
        select 1
        from advice_rooms r
        join group_members gm
          on gm.group_id = r.group_id
        where r.id = advice_room_participants.room_id
          and gm.user_id = auth.uid()
    )
);

-- Updated room query function

drop function if exists public.enter_advice_room(uuid, uuid);

create function public.enter_advice_room(
  p_movie_id uuid,
  p_group_id uuid
)
returns table (
  result_room_id uuid,
  result_room_status text,
  result_participant_count integer,
  result_room_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room advice_rooms;
  v_count integer;
begin
  select ar.*
  into v_room
  from advice_rooms ar
  where ar.movie_id = p_movie_id
    and ar.group_id = p_group_id
    and ar.status in ('waiting', 'discussion')
    and ar.expires_at > now()
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
      now() + interval '1 minute'
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
    and arp.status = 'active';

  if v_count > 1 and v_room.status = 'waiting' then
    update advice_rooms ar
    set status = 'discussion'
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
$$;

-- Create function to leave advice room

create or replace function public.leave_advice_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update advice_room_participants arp
  set
    status = 'left',
    finished_at = now(),
    last_seen_at = now()
  where arp.room_id = p_room_id
    and arp.user_id = auth.uid();
end;
$$;

