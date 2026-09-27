-- Movie Wishlist 1.2.x
-- Server-side Social Advice discovery, eligibility threshold 7 and push enqueue.

begin;

-- A category preference. The existing notifications_enabled flag remains
-- the master switch and the in-app (+N) badge is independent from both.
alter table public.profiles
add column if not exists social_advice_notifications_enabled boolean
not null default true;

-- The current social-graph rule expressed for an explicit viewer. This is
-- required by server-side triggers where auth.uid() is the recommendation
-- author rather than the eventual discovery recipient.
create or replace function public.can_user_read_recommendation(
  p_viewer_user_id uuid,
  p_recommendation_user_id uuid,
  p_recommendation_group_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_viewer_user_id is not null
    and (
      p_recommendation_user_id = p_viewer_user_id

      or exists (
        select 1
        from public.group_members me
        join public.group_members shared_user
          on shared_user.group_id = me.group_id
        where me.user_id = p_viewer_user_id
          and shared_user.user_id = p_recommendation_user_id
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
        where me.user_id = p_viewer_user_id
          and second_level_user.user_id = p_recommendation_user_id
      )
    );
$$;

revoke all
on function public.can_user_read_recommendation(uuid, uuid, uuid)
from public, anon, authenticated;

-- Keep RLS and all existing callers on exactly the same social-graph rule.
create or replace function public.can_read_recommendation(
  recommendation_user_id uuid,
  recommendation_group_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.can_user_read_recommendation(
    auth.uid(),
    recommendation_user_id,
    recommendation_group_id
  );
$$;

-- Explicit-user eligibility core. p_movie_id limits trigger recalculation to
-- the movie whose recommendation changed; NULL returns the complete pool.
create or replace function public.get_eligible_social_movies_for_user(
  p_user_id uuid,
  p_movie_id uuid default null
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
    where p_user_id is not null
      and (p_movie_id is null or recommendation.movie_id = p_movie_id)
      and recommendation.user_id <> p_user_id
      and public.can_user_read_recommendation(
        p_user_id,
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
      ) >= 7
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

revoke all
on function public.get_eligible_social_movies_for_user(uuid, uuid)
from public, anon, authenticated;

-- Authenticated wrapper used by Social Advice and Mykola. This preserves the
-- existing no-argument API while moving the threshold to one shared core.
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
    eligible.recommendations
  from public.get_eligible_social_movies_for_user(
    auth.uid(),
    null
  ) eligible
  where auth.uid() is not null;
$$;

revoke all
on function public.get_eligible_social_movies()
from public, anon, authenticated;

-- A narrow service-role API used by the push worker. Historical unseen rows
-- that are no longer eligible must not produce a push or inflate app badges.
create or replace function public.get_social_advice_push_state_for_user(
  p_user_id uuid,
  p_movie_id uuid
)
returns table (
  target_is_eligible boolean,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as materialized (
    select eligible_movie.movie_id
    from public.get_eligible_social_movies_for_user(
      p_user_id,
      null
    ) eligible_movie
  )
  select
    exists (
      select 1
      from eligible
      where eligible.movie_id = p_movie_id
    ) as target_is_eligible,
    count(discovery.movie_id) as unread_count
  from public.social_advice_discovery discovery
  join eligible
    on eligible.movie_id = discovery.movie_id
  where discovery.user_id = p_user_id
    and discovery.seen_at is null;
$$;

revoke all
on function public.get_social_advice_push_state_for_user(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.get_social_advice_push_state_for_user(uuid, uuid)
to service_role;

-- Enqueue one push request for one newly inserted discovery row.
create or replace function public.enqueue_social_advice_push(
  p_user_id uuid,
  p_movie_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_edge_secret text;
  v_function_url text;
begin
  select decrypted_secret
  into v_edge_secret
  from vault.decrypted_secrets
  where name = 'movie_wishlist_edge_secret'
  limit 1;

  if v_edge_secret is null then
    raise warning 'movie_wishlist_edge_secret not found';
    return;
  end if;

  v_function_url :=
    'https://mttkectgdqqmejpenkrn.supabase.co/functions/v1/send-social-advice-push';

  perform net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_edge_secret
    ),
    body := jsonb_build_object(
      'user_id', p_user_id,
      'movie_id', p_movie_id
    )
  );
end;
$$;

revoke all
on function public.enqueue_social_advice_push(uuid, uuid)
from public, anon, authenticated;

-- Insert-only semantics plus the primary key guarantee one discovery and at
-- most one push enqueue for a given user/movie pair.
create or replace function public.sync_social_advice_discovery_for_movie(
  p_movie_id uuid,
  p_send_push boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discovery record;
  v_inserted_count integer := 0;
begin
  if p_movie_id is null then
    return 0;
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

    if p_send_push then
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
on function public.sync_social_advice_discovery_for_movie(uuid, boolean)
from public, anon, authenticated;

create or replace function public.handle_recommendation_social_advice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.sync_social_advice_discovery_for_movie(
      OLD.movie_id,
      true
    );

    return OLD;
  end if;

  perform public.sync_social_advice_discovery_for_movie(
    NEW.movie_id,
    true
  );

  if TG_OP = 'UPDATE' and OLD.movie_id is distinct from NEW.movie_id then
    perform public.sync_social_advice_discovery_for_movie(
      OLD.movie_id,
      true
    );
  end if;

  return NEW;
end;
$$;

revoke all
on function public.handle_recommendation_social_advice()
from public, anon, authenticated;

-- Backfill first. It intentionally creates in-app unread state without a
-- migration-time push storm.
insert into public.social_advice_discovery (
  user_id,
  movie_id,
  became_eligible_at
)
select
  viewer.id,
  eligible.movie_id,
  now()
from public.profiles viewer
cross join lateral public.get_eligible_social_movies_for_user(
  viewer.id,
  null
) eligible
on conflict on constraint social_advice_discovery_pkey
do nothing;

drop trigger if exists trg_recommendation_social_advice
on public.recommendations;

create trigger trg_recommendation_social_advice
after insert or delete or update of
  movie_id,
  context_group_id,
  rating_value,
  comment
on public.recommendations
for each row
execute function public.handle_recommendation_social_advice();

commit;
