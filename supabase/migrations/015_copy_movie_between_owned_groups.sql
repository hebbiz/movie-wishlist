-- Copy group-list metadata only when the current user owns both groups.
-- Existing target entries are never changed; watched becomes wishlist.

create or replace function public.copy_movie_between_owned_groups(
  p_source_group_id uuid,
  p_target_group_id uuid,
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
  v_source public.movie_group_lists%rowtype;
  v_added_by text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_source_group_id is null or p_target_group_id is null or
     p_source_group_id = p_target_group_id then
    raise exception 'Source and target groups must differ' using errcode = '22023';
  end if;

  if (
    select count(distinct membership.group_id)
    from public.group_members membership
    where membership.user_id = v_user_id
      and membership.role = 'owner'
      and membership.group_id in (p_source_group_id, p_target_group_id)
  ) <> 2 then
    raise exception 'Owner access to both groups is required'
      using errcode = '42501';
  end if;

  select source_list.*
  into v_source
  from public.movie_group_lists source_list
  where source_list.group_id = p_source_group_id
    and source_list.movie_id = p_movie_id;

  if not found then
    raise exception 'Source movie not found' using errcode = 'P0002';
  end if;

  select coalesce(nullif(trim(profile.display_name), ''), 'Користувач')
  into v_added_by
  from public.profiles profile
  where profile.id = v_user_id;

  v_added_by := coalesce(v_added_by, 'Користувач');

  return query
  with inserted_row as (
    insert into public.movie_group_lists (
      movie_id, group_id, status, recommended_medium,
      owned_medium, purchase_url, added_by, updated_at
    )
    values (
      p_movie_id,
      p_target_group_id,
      case when v_source.status = 'watched' then 'wishlist'
           else v_source.status end,
      v_source.recommended_medium,
      v_source.owned_medium,
      v_source.purchase_url,
      v_added_by,
      now()
    )
    on conflict (movie_id, group_id) do nothing
    returning movie_group_lists.id, movie_group_lists.status,
      movie_group_lists.recommended_medium
  )
  select inserted_row.id, inserted_row.status,
    inserted_row.recommended_medium, true
  from inserted_row
  union all
  select existing_list.id, existing_list.status,
    existing_list.recommended_medium, false
  from public.movie_group_lists existing_list
  where existing_list.group_id = p_target_group_id
    and existing_list.movie_id = p_movie_id
    and not exists (select 1 from inserted_row)
  limit 1;
end;
$$;

revoke all on function public.copy_movie_between_owned_groups(uuid, uuid, uuid)
from public;
grant execute on function public.copy_movie_between_owned_groups(uuid, uuid, uuid)
to authenticated;
