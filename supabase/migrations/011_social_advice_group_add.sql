-- Movie Wishlist 1.2.x
-- Add a global Social Advice movie to an explicitly selected writable group.

begin;

create or replace function public.add_social_advice_movie_to_wishlist(
  p_target_group_id uuid,
  p_movie_id uuid
)
returns table (
  list_id uuid,
  status text,
  recommended_medium text,
  inserted boolean
)
language sql
security definer
set search_path = public
as $$
  select
    result.list_id,
    result.status,
    result.recommended_medium,
    result.inserted
  from public.add_mykola_social_movie_to_wishlist(
    p_target_group_id,
    p_movie_id
  ) result;
$$;

revoke all
on function public.add_social_advice_movie_to_wishlist(uuid, uuid)
from public, anon;

grant execute
on function public.add_social_advice_movie_to_wishlist(uuid, uuid)
to authenticated;

comment on function public.add_social_advice_movie_to_wishlist(uuid, uuid)
is 'Adds a Social Advice movie to wishlist in an explicitly selected owner/member group.';

commit;
