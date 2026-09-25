-- ============================================================
-- Movie Wishlist 1.2.x
-- Full archive context for the global Social Advice catalogue
--
-- The shared eligibility pool intentionally keeps only recommendations
-- with comments for the compact "Ask Mykola" social suggestion flow.
-- The Social Advice catalogue opens the regular archive context, where
-- every visible recommendation must be present, including a rating with
-- no comment. This RPC therefore builds its own complete recommendation
-- stack without changing Mykola's comments-only candidate payload.
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
    coalesce(full_context.recommendations, '[]'::jsonb),
    discovery.became_eligible_at,
    discovery.seen_at,
    discovery.seen_at is null as is_new
  from public.get_eligible_social_movies() eligible
  join public.social_advice_discovery discovery
    on discovery.user_id = v_user_id
    and discovery.movie_id = eligible.movie_id
  left join lateral (
    select
      jsonb_agg(
        jsonb_build_object(
          'recommendation_id', recommendation.id,
          'movie_id', recommendation.movie_id,
          'user_id', recommendation.user_id,
          'comment', recommendation.comment,
          'rating_value', recommendation.rating_value,
          'created_at', recommendation.created_at,
          'recommender_name', coalesce(
            nullif(trim(profile.display_name), ''),
            'Користувач'
          ),
          'source_group_id', source_group.id,
          'source_group_name', source_group.name,
          'source_group_type', source_group.type
        )
        order by
          recommendation.rating_value desc nulls last,
          recommendation.created_at desc,
          recommendation.id
      ) as recommendations
    from public.recommendations recommendation
    join public.groups source_group
      on source_group.id = recommendation.context_group_id
    join public.movie_group_lists source_list
      on source_list.group_id = recommendation.context_group_id
      and source_list.movie_id = recommendation.movie_id
    left join public.profiles profile
      on profile.id = recommendation.user_id
    where recommendation.movie_id = eligible.movie_id
      and recommendation.user_id <> v_user_id
      and public.can_read_recommendation(
        recommendation.user_id,
        recommendation.context_group_id
      )
  ) full_context on true
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
