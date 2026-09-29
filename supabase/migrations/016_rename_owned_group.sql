-- Rename an existing group without exposing general UPDATE access.
-- The group type and ownership metadata remain immutable through this RPC.

create or replace function public.rename_owned_group(
  p_group_id uuid,
  p_name text
)
returns table (
  id uuid,
  name text,
  type text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := trim(p_name);
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_group_id is null then
    raise exception 'Group is required' using errcode = '22023';
  end if;

  if v_name is null or v_name = '' then
    raise exception 'Group name is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.group_members membership
    where membership.group_id = p_group_id
      and membership.user_id = v_user_id
      and membership.role = 'owner'
  ) then
    raise exception 'Owner access to the group is required'
      using errcode = '42501';
  end if;

  return query
  update public.groups target_group
  set name = v_name
  where target_group.id = p_group_id
  returning target_group.id, target_group.name, target_group.type;

  if not found then
    raise exception 'Group not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.rename_owned_group(uuid, text)
from public;
grant execute on function public.rename_owned_group(uuid, text)
to authenticated;
