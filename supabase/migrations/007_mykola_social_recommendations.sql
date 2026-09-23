-- Mykola social recommendations
--
-- Socially connected users are direct connections only: people who share at
-- least one group with the current user. The query never expands recursively
-- through a connected user's other contacts.

create index if not exists recommendations_mykola_social_lookup_idx
on public.recommendations (
  context_group_id,
  rating_value desc,
  created_at desc,
  movie_id
)
where rating_value >= 8 and comment is not null;

create index if not exists groups_created_by_idx
on public.groups (created_by);

create or replace function public.get_mykola_social_candidates(
  p_current_group_id uuid
)
returns table (
  recommendation_id uuid,
  movie_id uuid,
  title text,
  year text,
  poster_url text,
  imdb_url text,
  source_medium text,
  comment text,
  rating_value numeric,
  recommendation_created_at timestamptz,
  recommender_name text,
  source_group_id uuid,
  source_group_name text,
  source_group_type text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.group_members current_membership
    where current_membership.group_id = p_current_group_id
      and current_membership.user_id = v_user_id
  ) then
    raise exception 'Current group is not available to this user'
      using errcode = '42501';
  end if;

  return query
  with direct_connections as (
    select distinct connected_member.user_id
    from public.group_members my_membership
    join public.group_members connected_member
      on connected_member.group_id = my_membership.group_id
    where my_membership.user_id = v_user_id
      and connected_member.user_id <> v_user_id
  ),
  adjacent_groups as (
    -- The user's other groups are adjacent because their members share that
    -- group directly with the user.
    select distinct user_group.group_id
    from public.group_members user_group
    where user_group.user_id = v_user_id
      and user_group.group_id <> p_current_group_id

    union

    -- A group created by a direct connection is also adjacent, even when the
    -- current user has not subscribed to it.
    select connected_group.id
    from public.groups connected_group
    join direct_connections connection
      on connection.user_id = connected_group.created_by
    where connected_group.id <> p_current_group_id
  ),
  ranked_candidates as (
    select
      recommendation.id as recommendation_id,
      recommendation.movie_id,
      movie.title,
      movie.year::text as year,
      movie.poster_url,
      movie.imdb_url,
      coalesce(
        source_list.owned_medium,
        source_list.recommended_medium,
        'Носій не вказано'
      ) as source_medium,
      recommendation.comment,
      recommendation.rating_value,
      recommendation.created_at as recommendation_created_at,
      coalesce(nullif(trim(profile.display_name), ''), 'Користувач')
        as recommender_name,
      source_group.id as source_group_id,
      source_group.name as source_group_name,
      source_group.type as source_group_type,
      row_number() over (
        partition by recommendation.movie_id
        order by
          recommendation.rating_value desc,
          recommendation.created_at desc,
          recommendation.id
      ) as movie_rank
    from public.recommendations recommendation
    join direct_connections connection
      on connection.user_id = recommendation.user_id
    join adjacent_groups adjacent_group
      on adjacent_group.group_id = recommendation.context_group_id
    join public.groups source_group
      on source_group.id = recommendation.context_group_id
    join public.movie_group_lists source_list
      on source_list.group_id = recommendation.context_group_id
      and source_list.movie_id = recommendation.movie_id
    join public.movies movie
      on movie.id = recommendation.movie_id
    left join public.profiles profile
      on profile.id = recommendation.user_id
    where recommendation.rating_value >= 8
      and nullif(trim(recommendation.comment), '') is not null
      and recommendation.user_id <> v_user_id
      and not exists (
        select 1
        from public.movie_group_lists current_list
        where current_list.group_id = p_current_group_id
          and current_list.movie_id = recommendation.movie_id
      )
  )
  select
    candidate.recommendation_id,
    candidate.movie_id,
    candidate.title,
    candidate.year,
    candidate.poster_url,
    candidate.imdb_url,
    candidate.source_medium,
    candidate.comment,
    candidate.rating_value,
    candidate.recommendation_created_at,
    candidate.recommender_name,
    candidate.source_group_id,
    candidate.source_group_name,
    candidate.source_group_type
  from ranked_candidates candidate
  where candidate.movie_rank = 1
  order by
    candidate.rating_value desc,
    candidate.recommendation_created_at desc,
    candidate.movie_id;
end;
$$;

revoke all on function public.get_mykola_social_candidates(uuid) from public;
grant execute on function public.get_mykola_social_candidates(uuid) to authenticated;

create or replace function public.add_mykola_social_movie_to_wishlist(
  p_current_group_id uuid,
  p_movie_id uuid
)
returns table (
  list_id uuid,
  status text,
  recommended_medium text,
  inserted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_added_by text;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.group_members current_membership
    where current_membership.group_id = p_current_group_id
      and current_membership.user_id = v_user_id
      and current_membership.role in ('owner', 'member')
  ) then
    raise exception 'Only group owners and members can add movies'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.movies movie
    where movie.id = p_movie_id
  ) then
    raise exception 'Movie not found'
      using errcode = 'P0002';
  end if;

  select coalesce(
    nullif(trim(profile.display_name), ''),
    'Користувач'
  )
  into v_added_by
  from public.profiles profile
  where profile.id = v_user_id;

  v_added_by := coalesce(v_added_by, 'Користувач');

  return query
  with inserted_row as (
    insert into public.movie_group_lists (
      movie_id,
      group_id,
      status,
      recommended_medium,
      owned_medium,
      purchase_url,
      added_by,
      updated_at
    )
    values (
      p_movie_id,
      p_current_group_id,
      'wishlist',
      null,
      null,
      null,
      v_added_by,
      now()
    )
    on conflict (movie_id, group_id) do nothing
    returning
      movie_group_lists.id,
      movie_group_lists.status,
      movie_group_lists.recommended_medium
  )
  select
    inserted_row.id,
    inserted_row.status,
    inserted_row.recommended_medium,
    true
  from inserted_row

  union all

  select
    existing_list.id,
    existing_list.status,
    existing_list.recommended_medium,
    false
  from public.movie_group_lists existing_list
  where existing_list.group_id = p_current_group_id
    and existing_list.movie_id = p_movie_id
    and not exists (select 1 from inserted_row)
  limit 1;
end;
$$;

revoke all on function public.add_mykola_social_movie_to_wishlist(uuid, uuid)
from public;
grant execute on function public.add_mykola_social_movie_to_wishlist(uuid, uuid)
to authenticated;

-- 
-- Mykola social archive aggregation
--
-- Keeps the exact direct-connection boundary introduced in migration 006,
-- but aggregates every visible rating for a movie across adjacent groups.
-- The client uses average_rating only as a small random-selection bias.

create index if not exists recommendations_mykola_archive_lookup_idx
on public.recommendations (
  context_group_id,
  movie_id,
  rating_value,
  created_at desc
);

create or replace function public.get_mykola_social_candidates_v2(
  p_current_group_id uuid
)
returns table (
  movie_id uuid,
  title text,
  year text,
  poster_url text,
  imdb_url text,
  source_medium text,
  average_rating numeric,
  rating_count bigint,
  recommendations jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.group_members current_membership
    where current_membership.group_id = p_current_group_id
      and current_membership.user_id = v_user_id
  ) then
    raise exception 'Current group is not available to this user'
      using errcode = '42501';
  end if;

  return query
  with direct_connections as (
    select distinct connected_member.user_id
    from public.group_members my_membership
    join public.group_members connected_member
      on connected_member.group_id = my_membership.group_id
    where my_membership.user_id = v_user_id
      and connected_member.user_id <> v_user_id
  ),
  adjacent_groups as (
    select distinct user_group.group_id
    from public.group_members user_group
    where user_group.user_id = v_user_id
      and user_group.group_id <> p_current_group_id

    union

    select connected_group.id
    from public.groups connected_group
    join direct_connections connection
      on connection.user_id = connected_group.created_by
    where connected_group.id <> p_current_group_id
  ),
  visible_recommendations as (
    select
      recommendation.id as recommendation_id,
      recommendation.movie_id,
      movie.title,
      movie.year::text as year,
      movie.poster_url,
      movie.imdb_url,
      coalesce(
        source_list.owned_medium,
        source_list.recommended_medium,
        'Носій не вказано'
      ) as source_medium,
      recommendation.user_id,
      recommendation.comment,
      recommendation.rating_value,
      recommendation.created_at,
      coalesce(nullif(trim(profile.display_name), ''), 'Користувач')
        as recommender_name,
      source_group.id as source_group_id,
      source_group.name as source_group_name,
      source_group.type as source_group_type
    from public.recommendations recommendation
    join direct_connections connection
      on connection.user_id = recommendation.user_id
    join adjacent_groups adjacent_group
      on adjacent_group.group_id = recommendation.context_group_id
    join public.groups source_group
      on source_group.id = recommendation.context_group_id
    join public.movie_group_lists source_list
      on source_list.group_id = recommendation.context_group_id
      and source_list.movie_id = recommendation.movie_id
    join public.movies movie
      on movie.id = recommendation.movie_id
    left join public.profiles profile
      on profile.id = recommendation.user_id
    where recommendation.user_id <> v_user_id
      and not exists (
        select 1
        from public.movie_group_lists current_list
        where current_list.group_id = p_current_group_id
          and current_list.movie_id = recommendation.movie_id
      )
  ),
  movie_aggregates as (
    select
      visible.movie_id,
      max(visible.title) as title,
      max(visible.year) as year,
      max(visible.poster_url) as poster_url,
      max(visible.imdb_url) as imdb_url,
      avg(visible.rating_value) filter (
        where visible.rating_value is not null
      ) as average_rating,
      count(visible.rating_value) as rating_count,
      jsonb_agg(
        jsonb_build_object(
          'recommendation_id', visible.recommendation_id,
          'movie_id', visible.movie_id,
          'user_id', visible.user_id,
          'comment', visible.comment,
          'rating_value', visible.rating_value,
          'created_at', visible.created_at,
          'recommender_name', visible.recommender_name,
          'source_group_id', visible.source_group_id,
          'source_group_name', visible.source_group_name,
          'source_group_type', visible.source_group_type
        )
        order by
          visible.rating_value desc nulls last,
          visible.created_at desc,
          visible.recommendation_id
      ) filter (
        where nullif(trim(visible.comment), '') is not null
      ) as recommendations
    from visible_recommendations visible
    group by visible.movie_id
    having
      avg(visible.rating_value) filter (
        where visible.rating_value is not null
      ) >= 8
      and count(*) filter (
        where nullif(trim(visible.comment), '') is not null
      ) > 0
  ),
  preferred_sources as (
    select distinct on (visible.movie_id)
      visible.movie_id,
      visible.source_medium
    from visible_recommendations visible
    order by
      visible.movie_id,
      visible.rating_value desc nulls last,
      visible.created_at desc,
      visible.recommendation_id
  )
  select
    aggregate.movie_id,
    aggregate.title,
    aggregate.year,
    aggregate.poster_url,
    aggregate.imdb_url,
    preferred_source.source_medium,
    aggregate.average_rating,
    aggregate.rating_count,
    aggregate.recommendations
  from movie_aggregates aggregate
  join preferred_sources preferred_source
    on preferred_source.movie_id = aggregate.movie_id
  order by aggregate.movie_id;
end;
$$;

revoke all on function public.get_mykola_social_candidates_v2(uuid)
from public;
grant execute on function public.get_mykola_social_candidates_v2(uuid)
to authenticated;

