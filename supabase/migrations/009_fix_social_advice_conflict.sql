-- Fix PL/pgSQL output-column ambiguity in get_social_advice_movies().
--
-- The function has an output column named movie_id. In PL/pgSQL that output
-- column is also a variable, so ON CONFLICT (user_id, movie_id) is ambiguous.
-- Referencing the named primary-key constraint removes the ambiguity.

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
  on conflict on constraint social_advice_discovery_pkey
  do nothing;

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
