-- Movie Wishlist 1.2.x
-- Global unread state for the user-owned Social Advice catalogue.

begin;

create or replace function public.mark_social_advice_movies_seen(
  p_movie_ids uuid[]
)
returns table (
  marked_count bigint,
  marked_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_marked_at timestamptz := clock_timestamp();
  v_marked_count bigint := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if coalesce(cardinality(p_movie_ids), 0) = 0 then
    return query
    select v_marked_count, v_marked_at;
    return;
  end if;

  update public.social_advice_discovery as discovery
  set seen_at = v_marked_at
  where discovery.user_id = v_user_id
    and discovery.seen_at is null
    and discovery.movie_id = any(p_movie_ids)
    and exists (
      select 1
      from public.get_eligible_social_movies() eligible
      where eligible.movie_id = discovery.movie_id
    );

  get diagnostics v_marked_count = row_count;

  return query
  select v_marked_count, v_marked_at;
end;
$$;

revoke all
on function public.mark_social_advice_movies_seen(uuid[])
from public, anon;

grant execute
on function public.mark_social_advice_movies_seen(uuid[])
to authenticated;

comment on function public.mark_social_advice_movies_seen(uuid[])
is 'Marks only the supplied currently eligible Social Advice discoveries as seen for auth.uid().';

commit;
