-- Movie_Group_Lists create table SQL

create table if not exists public.movie_group_lists (
  id uuid primary key default gen_random_uuid(),

  movie_id uuid not null references public.movies(id) on delete cascade,

  group_id uuid not null references public.groups(id) on delete cascade,

  status text not null default 'wishlist',

  recommended_medium text,
  owned_medium text,

  purchase_url text,

  added_by text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (movie_id, group_id)
);

-- Seed Movies into Group Lists SQL

insert into public.movie_group_lists (
  movie_id,
  group_id,
  status,
  recommended_medium,
  owned_medium,
  purchase_url,
  added_by
)
select
  id,
  '2481bff1-a26f-4173-8a47-f1b16029079d',
  status,
  recommended_medium,
  owned_medium,
  purchase_url,
  added_by
from public.movies
on conflict (movie_id, group_id) do nothing;

-- Access Control for User’s Group Lists SQL

create policy "Users can read own group lists"
on public.movie_group_lists
for select
to authenticated
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = movie_group_lists.group_id
      and gm.user_id = auth.uid()
  )
);

-- Restrict Inserts to Authorized Group Members SQL

create policy "Members can insert movie group lists"
on public.movie_group_lists
for insert
to authenticated
with check (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = movie_group_lists.group_id
      and gm.user_id = auth.uid()
  )
);

-- Restrict Updates to Movie Group Members SQL

create policy "Members can update movie group lists"
on public.movie_group_lists
for update
to authenticated
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = movie_group_lists.group_id
      and gm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = movie_group_lists.group_id
      and gm.user_id = auth.uid()
  )
);

-- Allow group members to delete movie group lists SQL

create policy "Members can delete movie group lists"
on public.movie_group_lists
for delete
to authenticated
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = movie_group_lists.group_id
      and gm.user_id = auth.uid()
  )
);

-- Remove Deprecated Movie Metadata Columns SQL

alter table public.movies
drop column if exists recommended_medium,
drop column if exists status,
drop column if exists is_owned,
drop column if exists owned_medium,
drop column if exists purchase_url,
drop column if exists added_by;

-- Allow Users to Read Their Groups

create policy "Group members can read their groups"
on public.groups
for select
to authenticated
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = groups.id
      and gm.user_id = auth.uid()
  )
);

-- Enforce Unique Group–Movie Pairs

create unique index movie_group_lists_group_movie_unique
on movie_group_lists (group_id, movie_id);
-- Add imdb_id Column to Movies

alter table movies
add column if not exists imdb_id text;

-- Populate missing IMDb IDs

update movies
set imdb_id = substring(imdb_url from '(tt[0-9]+)')
where imdb_id is null
  and imdb_url is not null;

-- Make imdb_id Required

alter table movies
alter column imdb_id set not null;

-- Enforce Unique IMDb IDs

alter table movies
add constraint movies_imdb_id_unique
unique (imdb_id);

-- Validate IMDb ID Format



