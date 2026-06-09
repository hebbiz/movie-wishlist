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

-- Get Current User’s Role in a Group

create or replace function public.current_user_group_role(target_group_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select role
  from public.group_members
  where group_id = target_group_id
    and user_id = auth.uid()
  limit 1;
$$;

-- Remove Group Members Select Policy

drop policy if exists "group_members_select" on public.group_members;

-- Restrict Group Member Select Access

create policy "group_members_select"
on public.group_members
for select
to authenticated
using (
  public.current_user_group_role(group_id) in ('owner', 'member')
  or user_id = auth.uid()
);

-- Profiles row-level access for group members

create policy "profiles_select_visible_group_members"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.group_members gm_target
    where gm_target.user_id = profiles.id
      and public.current_user_group_role(gm_target.group_id) in ('owner', 'member')
  )
);

-- Owner-restricted group member deletes

create policy "Owners can remove group members"
on public.group_members
for delete
to authenticated
using (
  role <> 'owner'
  and exists (
    select 1
    from public.group_members owner_membership
    where owner_membership.group_id = group_members.group_id
      and owner_membership.user_id = auth.uid()
      and owner_membership.role = 'owner'
  )
);


-- Add Group Subscriber Flag

alter table group_members
add column is_group_subscriber boolean not null default false;

-- Add Required Email to Invitations

alter table invitations
add column email text not null;

-- User-Scoped Invitation Acceptance Policy

create policy "Users can accept their own invitations"
on public.group_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.invitations i
    where i.group_id = group_members.group_id
      and lower(i.email) = lower(auth.jwt() ->> 'email')
      and i.role = group_members.role
  )
);

-- Email-Based Invitation Read Policy

create policy "Users can read invitations for their email"
on public.invitations
for select
to authenticated
using (
  lower(email) = lower(auth.jwt() ->> 'email')
);

-- Restrict Deletion of Invitations to Email Owner

create policy "Users can delete used invitations for their email"
on public.invitations
for delete
to authenticated
using (
  lower(email) = lower(auth.jwt() ->> 'email')
);

-- Invitations Management Table

create table invitations (
  id uuid primary key default gen_random_uuid(),

  group_id uuid not null references groups(id) on delete cascade,

  role text not null
    check (role in ('member', 'visitor')),

  token text not null unique,

  created_by uuid not null references profiles(id),

  created_at timestamptz not null default now(),

  expires_at timestamptz,

  used_by uuid references profiles(id),
  used_at timestamptz
);

-- Indexes for invitations token and group

create index invitations_token_idx
on invitations(token);

create index invitations_group_id_idx
on invitations(group_id);

-- Owner-Only Invitation Inserts

create policy "Owners can create invitations"
on invitations
for insert
with check (
  exists (
    select 1
    from group_members
    where group_members.group_id = invitations.group_id
      and group_members.user_id = auth.uid()
      and group_members.role = 'owner'
  )
);

-- Read Access for Authenticated Users

create policy "Authenticated users can read invitations"
on invitations
for select
to authenticated
using (true);

-- Add created_by Reference Column to Groups

alter table public.groups
add column created_by uuid references auth.users(id);

-- Allow Authenticated Group Creation

create policy "Authenticated users can create groups"
on public.groups
for insert
to authenticated
with check (
  created_by = auth.uid()
);

-- Owner Role Insert Policy for User’s Groups

create policy "Users can create owner membership for own groups"
on public.group_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1
    from public.groups g
    where g.id = group_members.group_id
      and g.created_by = auth.uid()
  )
);

-- Enable user group read access

create policy "Users can read groups they created"
on public.groups
for select
to authenticated
using (
  created_by = auth.uid()
);


