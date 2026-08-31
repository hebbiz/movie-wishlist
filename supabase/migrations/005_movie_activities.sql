/*
  Movie Wishlist
  Movie Activity — Stage 1

  Створюємо лише структуру таблиць.
  Ніяких triggers / RPC / scheduled jobs на цьому етапі.
*/


-- ============================================================
-- 1. Актуальна activity фільму
-- ============================================================

create table public.movie_activity (
  id uuid primary key default gen_random_uuid(),

  group_id uuid not null
    references public.groups(id)
    on delete cascade,

  movie_id uuid not null
    references public.movies(id)
    on delete cascade,

  actor_user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  activity_category text not null
    default 'catalog_status',

  from_status text,

  to_status text not null,

  created_at timestamptz not null
    default now(),

  constraint movie_activity_current_event_unique
    unique (
      group_id,
      movie_id,
      activity_category
    )
);


-- ============================================================
-- 2. Персональні адресати activity
-- ============================================================

create table public.movie_activity_recipients (
  activity_id uuid not null
    references public.movie_activity(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  seen_at timestamptz,

  primary key (
    activity_id,
    user_id
  )
);


-- ============================================================
-- 3. Індекси
-- ============================================================

create index movie_activity_group_status_idx
  on public.movie_activity (
    group_id,
    to_status
  );


create index movie_activity_created_at_idx
  on public.movie_activity (
    created_at
  );


create index movie_activity_recipients_unseen_user_idx
  on public.movie_activity_recipients (
    user_id,
    activity_id
  )
  where seen_at is null;


-- ============================================================
-- 4. RLS
-- ============================================================

alter table public.movie_activity
  enable row level security;

alter table public.movie_activity_recipients
  enable row level security;
