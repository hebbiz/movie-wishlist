-- Add table for recommendations & RLS

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),

  movie_id uuid not null references public.movies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  context_group_id uuid not null references public.groups(id) on delete cascade,

  created_at timestamptz not null default now(),

  unique (movie_id, user_id)
);

alter table public.recommendations enable row level security;

create policy "Users can read own recommendations"
on public.recommendations
for select
to authenticated
using (
  user_id = auth.uid()
);

create policy "Users can create own recommendations in available group"
on public.recommendations
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.group_members gm
    where gm.group_id = recommendations.context_group_id
      and gm.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.movie_group_lists mgl
    where mgl.group_id = recommendations.context_group_id
      and mgl.movie_id = recommendations.movie_id
  )
);

create policy "Users can delete own recommendations"
on public.recommendations
for delete
to authenticated
using (
  user_id = auth.uid()
);

-- =====================================================
-- 2026-06-18
-- Recommendations visibility
-- Allow users to see recommendations from socially
-- connected users (shared group membership)
-- =====================================================

drop policy if exists "Users can read visible recommendations"
on public.recommendations;

create policy "Users can read visible recommendations"
on public.recommendations
for select
to authenticated
using (
  user_id = auth.uid()

  or exists (
    select 1
    from public.group_members my_membership
    join public.group_members connected_membership
      on connected_membership.group_id = my_membership.group_id
    where my_membership.user_id = auth.uid()
      and connected_membership.user_id = recommendations.user_id
      and connected_membership.user_id <> auth.uid()
  )
);

-- Recommendations: allow users to read recommendations from socially connected groups
drop policy if exists "Users can read recommendations from socially connected groups"
on public.recommendations;

create policy "Users can read recommendations from socially connected groups"
on public.recommendations
for select
to authenticated
using (
  exists (
    select 1
    from public.group_members my_groups
    join public.group_members connected_members
      on connected_members.group_id = my_groups.group_id
    join public.group_members connected_user_groups
      on connected_user_groups.user_id = connected_members.user_id
    join public.movie_group_lists connected_movies
      on connected_movies.group_id = connected_user_groups.group_id
    where my_groups.user_id = auth.uid()
      and connected_movies.movie_id = recommendations.movie_id
  )
);

-- Movie Wishlist
-- Дозволяє бачити профілі користувачів, чиї рекомендації доступні поточному користувачу

drop policy if exists "profiles_select_visible_recommendation_users" on profiles;

create policy "profiles_select_visible_recommendation_users"
on profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from recommendations r
    where r.user_id = profiles.id
  )
);

drop policy if exists "profiles_select_visible_recommendation_users"
on profiles;

-- Allowa reading profiles of the socially connected group users

drop policy if exists "profiles_select_visible_recommendation_users"
on profiles;

create policy "profiles_select_group_members"
on profiles
for select
to authenticated
using (
  id = auth.uid()

  or exists (
    select 1
    from group_members me
    join group_members other_member
      on other_member.group_id = me.group_id
    where me.user_id = auth.uid()
      and other_member.user_id = profiles.id
  )
);
