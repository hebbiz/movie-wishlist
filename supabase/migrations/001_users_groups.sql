-- Applied manually in production via Supabase SQL Editor
-- 2026-05-31
-- Adds profiles, groups, group_members and auth trigger

-- SQL - Profiles, Groups and Membership schema

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'family',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),

  unique (group_id, user_id)
);

insert into public.groups (name, type, is_default)
select 'Сімʼя', 'family', true
where not exists (
  select 1 from public.groups where is_default = true
);

-- SQL - Initialize Profile and Default Group Membership

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_group_id uuid;
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;

  select id
  into default_group_id
  from public.groups
  where is_default = true
  limit 1;

  if default_group_id is not null then
    insert into public.group_members (group_id, user_id, role)
    values (default_group_id, new.id, 'visitor')
    on conflict (group_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- SQL - Sync Profiles and Default Group Membership

insert into public.profiles (id, email, display_name, avatar_url)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'),
  raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do update
set
  email = excluded.email,
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url;

insert into public.group_members (group_id, user_id, role)
select
  g.id,
  p.id,
  'member'
from public.profiles p
cross join public.groups g
where g.is_default = true
on conflict (group_id, user_id) do nothing;

-- Access RLS policy for users to read their own profile

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- User Profile Update Policy

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- User Membership Update Policy

create policy "Users can read own group membership"
on group_members
for select
to authenticated
using (
  user_id = auth.uid()
);

-- Group member select access policy

CREATE POLICY "group_members_select"
ON group_members
FOR SELECT
TO authenticated
USING (

  EXISTS (
    SELECT 1
    FROM group_members my_membership
    WHERE my_membership.group_id = group_members.group_id
      AND my_membership.user_id = auth.uid()
      AND my_membership.role IN ('owner', 'member')
  )

  OR

  group_members.user_id = auth.uid()

);
