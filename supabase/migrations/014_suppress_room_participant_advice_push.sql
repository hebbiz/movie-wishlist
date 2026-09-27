-- Movie Wishlist 1.2.x
-- Do not send Social Advice push notifications to participants of the
-- multi-user Advice Room that produced the recommendation.

begin;

alter table public.recommendations
add column if not exists advice_room_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recommendations_advice_room_id_fkey'
      and conrelid = 'public.recommendations'::regclass
  ) then
    alter table public.recommendations
    add constraint recommendations_advice_room_id_fkey
    foreign key (advice_room_id)
    references public.advice_rooms(id)
    on delete set null;
  end if;
end;
$$;

create index if not exists recommendations_advice_room_id_idx
on public.recommendations (advice_room_id)
where advice_room_id is not null;

-- Three-argument implementation used by the recommendation trigger.
create or replace function public.sync_social_advice_discovery_for_movie(
  p_movie_id uuid,
  p_send_push boolean,
  p_advice_room_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discovery record;
  v_inserted_count integer := 0;
  v_room_participant_count integer := 0;
  v_suppress_for_recipient boolean := false;
begin
  if p_movie_id is null then
    return 0;
  end if;

  if p_advice_room_id is not null then
    select count(*)::integer
    into v_room_participant_count
    from public.advice_room_participants participant
    where participant.room_id = p_advice_room_id
      and (
        participant.status in ('active', 'finished')
        or participant.submitted_at is not null
      );
  end if;

  for v_discovery in
    insert into public.social_advice_discovery (
      user_id,
      movie_id,
      became_eligible_at
    )
    select
      viewer.id,
      p_movie_id,
      now()
    from public.profiles viewer
    where exists (
      select 1
      from public.get_eligible_social_movies_for_user(
        viewer.id,
        p_movie_id
      ) eligible
    )
    on conflict on constraint social_advice_discovery_pkey
    do nothing
    returning
      social_advice_discovery.user_id,
      social_advice_discovery.movie_id
  loop
    v_inserted_count := v_inserted_count + 1;
    v_suppress_for_recipient := false;

    if
      p_advice_room_id is not null
      and v_room_participant_count >= 2
    then
      select exists (
        select 1
        from public.advice_room_participants participant
        where participant.room_id = p_advice_room_id
          and participant.user_id = v_discovery.user_id
          and (
            participant.status in ('active', 'finished')
            or participant.submitted_at is not null
          )
      )
      into v_suppress_for_recipient;
    end if;

    if p_send_push and not v_suppress_for_recipient then
      perform public.enqueue_social_advice_push(
        v_discovery.user_id,
        v_discovery.movie_id
      );
    end if;
  end loop;

  return v_inserted_count;
end;
$$;

revoke all
on function public.sync_social_advice_discovery_for_movie(
  uuid,
  boolean,
  uuid
)
from public, anon, authenticated;

-- Preserve the previous internal two-argument API for any existing callers.
create or replace function public.sync_social_advice_discovery_for_movie(
  p_movie_id uuid,
  p_send_push boolean default true
)
returns integer
language sql
security definer
set search_path = public
as $$
  select public.sync_social_advice_discovery_for_movie(
    p_movie_id,
    p_send_push,
    null
  );
$$;

revoke all
on function public.sync_social_advice_discovery_for_movie(uuid, boolean)
from public, anon, authenticated;

create or replace function public.handle_recommendation_social_advice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_advice_room_id uuid;
  v_old_advice_room_id uuid;
begin
  if TG_OP = 'DELETE' then
    select room.id
    into v_old_advice_room_id
    from public.advice_rooms room
    where room.id = OLD.advice_room_id
      and room.movie_id = OLD.movie_id
      and room.group_id = OLD.context_group_id
      and exists (
        select 1
        from public.advice_room_participants participant
        where participant.room_id = room.id
          and participant.user_id = OLD.user_id
      );

    perform public.sync_social_advice_discovery_for_movie(
      OLD.movie_id,
      true,
      v_old_advice_room_id
    );

    return OLD;
  end if;

  select room.id
  into v_advice_room_id
  from public.advice_rooms room
  where room.id = NEW.advice_room_id
    and room.movie_id = NEW.movie_id
    and room.group_id = NEW.context_group_id
    and exists (
      select 1
      from public.advice_room_participants participant
      where participant.room_id = room.id
        and participant.user_id = NEW.user_id
    );

  perform public.sync_social_advice_discovery_for_movie(
    NEW.movie_id,
    true,
    v_advice_room_id
  );

  if TG_OP = 'UPDATE' and OLD.movie_id is distinct from NEW.movie_id then
    select room.id
    into v_old_advice_room_id
    from public.advice_rooms room
    where room.id = OLD.advice_room_id
      and room.movie_id = OLD.movie_id
      and room.group_id = OLD.context_group_id
      and exists (
        select 1
        from public.advice_room_participants participant
        where participant.room_id = room.id
          and participant.user_id = OLD.user_id
      );

    perform public.sync_social_advice_discovery_for_movie(
      OLD.movie_id,
      true,
      v_old_advice_room_id
    );
  end if;

  return NEW;
end;
$$;

revoke all
on function public.handle_recommendation_social_advice()
from public, anon, authenticated;

comment on column public.recommendations.advice_room_id is
  'Advice Room that produced this recommendation; used for push suppression only.';

commit;
