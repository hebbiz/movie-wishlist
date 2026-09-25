-- Movie Wishlist 1.2.x
-- Social Advice: backend foundation
--
-- Product boundary:
--   * recommendations remain the source of truth;
--   * eligibility is global and user-scoped;
--   * social_advice_discovery stores only persistent discovery/read state;
--   * movie_group_lists remains group-owned and is not changed here.

begin;

-- ============================================================
-- 1. Persistent user-owned discovery state
-- ============================================================

create table if not exists public.social_advice_discovery (
  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  movie_id uuid not null
    references public.movies(id)
    on delete cascade,

  became_eligible_at timestamptz not null default now(),
  seen_at timestamptz,

  constraint social_advice_discovery_pkey
    primary key (user_id, movie_id)
);

create index if not exists social_advice_discovery_unseen_user_idx
on public.social_advice_discovery (
  user_id,
  became_eligible_at desc
)
where seen_at is null;

create index if not exists social_advice_discovery_movie_idx
on public.social_advice_discovery (movie_id);

alter table public.social_advice_discovery
  enable row level security;

drop policy if exists social_advice_discovery_select_own
on public.social_advice_discovery;

create policy social_advice_discovery_select_own
on public.social_advice_discovery
for select
to authenticated
using (user_id = (select auth.uid()));

-- The browser may read only its own state. Creation and future seen-state
-- updates go through controlled RPCs so a client cannot delete its history
-- and make the same movie "new" again.
revoke all privileges
on table public.social_advice_discovery
from anon, authenticated;

grant select
on table public.social_advice_discovery
to authenticated;

-- ============================================================
-- 2. One shared eligibility core
-- ============================================================

create or replace function public.get_eligible_social_movies()
returns table (
  movie_id uuid,
  title text,
  year text,
  poster_url text,
  imdb_url text,
  source_medium text,
  average_rating numeric,
  rating_count bigint,
  recommendation_count bigint,
  comment_count bigint,
  latest_recommendation_at timestamptz,
  recommendations jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with visible_recommendations as (
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
      coalesce(
        nullif(trim(profile.display_name), ''),
        'Користувач'
      ) as recommender_name,
      source_group.id as source_group_id,
      source_group.name as source_group_name,
      source_group.type as source_group_type
    from public.recommendations recommendation
    join public.groups source_group
      on source_group.id = recommendation.context_group_id
    join public.movie_group_lists source_list
      on source_list.group_id = recommendation.context_group_id
      and source_list.movie_id = recommendation.movie_id
    join public.movies movie
      on movie.id = recommendation.movie_id
    left join public.profiles profile
      on profile.id = recommendation.user_id
    where auth.uid() is not null
      and recommendation.user_id <> auth.uid()
      and public.can_read_recommendation(
        recommendation.user_id,
        recommendation.context_group_id
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
      count(*) as recommendation_count,
      count(*) filter (
        where nullif(trim(visible.comment), '') is not null
      ) as comment_count,
      max(visible.created_at) as latest_recommendation_at,
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
    aggregate.recommendation_count,
    aggregate.comment_count,
    aggregate.latest_recommendation_at,
    aggregate.recommendations
  from movie_aggregates aggregate
  join preferred_sources preferred_source
    on preferred_source.movie_id = aggregate.movie_id;
$$;

-- Internal implementation detail. Only owner-run RPCs below may call it.
revoke all
on function public.get_eligible_social_movies()
from public, anon, authenticated;

-- ============================================================
-- 3. Global user-scoped Social Advice RPC
-- ============================================================

create or replace function public.get_social_advice_movies()
returns table (
  movie_id uuid,
  title text,
  year text,
  poster_url text,
  imdb_url text,
  source_medium text,
  average_rating numeric,
  rating_count bigint,
  recommendation_count bigint,
  comment_count bigint,
  latest_recommendation_at timestamptz,
  recommendations jsonb,
  became_eligible_at timestamptz,
  seen_at timestamptz,
  is_new boolean
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

  -- First observation creates the permanent discovery record. A later
  -- eligible -> ineligible -> eligible transition cannot create it again.
  insert into public.social_advice_discovery (
    user_id,
    movie_id,
    became_eligible_at
  )
  select
    v_user_id,
    eligible.movie_id,
    now()
  from public.get_eligible_social_movies() eligible
  on conflict (user_id, movie_id) do nothing;

  return query
  select
    eligible.movie_id,
    eligible.title,
    eligible.year,
    eligible.poster_url,
    eligible.imdb_url,
    eligible.source_medium,
    eligible.average_rating,
    eligible.rating_count,
    eligible.recommendation_count,
    eligible.comment_count,
    eligible.latest_recommendation_at,
    eligible.recommendations,
    discovery.became_eligible_at,
    discovery.seen_at,
    discovery.seen_at is null as is_new
  from public.get_eligible_social_movies() eligible
  join public.social_advice_discovery discovery
    on discovery.user_id = v_user_id
    and discovery.movie_id = eligible.movie_id
  order by
    (discovery.seen_at is null) desc,
    discovery.became_eligible_at desc,
    eligible.latest_recommendation_at desc,
    eligible.average_rating desc,
    eligible.title;
end;
$$;

revoke all
on function public.get_social_advice_movies()
from public, anon;

grant execute
on function public.get_social_advice_movies()
to authenticated;

-- ============================================================
-- 4. Keep Mykola on the same eligibility pool
-- ============================================================

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
  select
    eligible.movie_id,
    eligible.title,
    eligible.year,
    eligible.poster_url,
    eligible.imdb_url,
    eligible.source_medium,
    eligible.average_rating,
    eligible.rating_count,
    eligible.recommendations
  from public.get_eligible_social_movies() eligible
  where not exists (
    select 1
    from public.movie_group_lists current_list
    where current_list.group_id = p_current_group_id
      and current_list.movie_id = eligible.movie_id
  )
  order by eligible.movie_id;
end;
$$;

revoke all
on function public.get_mykola_social_candidates_v2(uuid)
from public, anon;

grant execute
on function public.get_mykola_social_candidates_v2(uuid)
to authenticated;

commit;
