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

/*
  Movie Wishlist
  Movie Activity — Stage 2

  Internal helper:
  створює або повністю замінює актуальну
  catalog_status activity для одного фільму.

  Поки НЕ підключена до trigger.
*/


create or replace function public.replace_movie_catalog_activity(
  p_group_id uuid,
  p_movie_id uuid,
  p_actor_user_id uuid,
  p_from_status text,
  p_to_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity_id uuid;
  v_recipient_count integer;
begin

  -- ----------------------------------------------------------
  -- 1. Базова перевірка аргументів
  -- ----------------------------------------------------------

  if p_group_id is null
     or p_movie_id is null
     or p_actor_user_id is null
     or p_to_status is null then

    raise exception
      'Movie activity requires group_id, movie_id, actor_user_id and to_status';
  end if;


  -- ----------------------------------------------------------
  -- 2. Actor повинен бути учасником цієї групи
  --
  -- У group_members знаходяться owner / member / visitor,
  -- тому це також захищає функцію від довільного actor UUID.
  -- ----------------------------------------------------------

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_actor_user_id
  ) then

    raise exception
      'Actor is not a member of this group';
  end if;


  -- ----------------------------------------------------------
  -- 3. Фільм повинен реально існувати у каталозі цієї групи
  -- ----------------------------------------------------------

  if not exists (
    select 1
    from public.movie_group_lists mgl
    where mgl.group_id = p_group_id
      and mgl.movie_id = p_movie_id
  ) then

    raise exception
      'Movie is not present in this group';
  end if;


  -- ----------------------------------------------------------
  -- 4. Прибираємо попередню status activity цього фільму
  --
  -- movie_activity_recipients видаляться автоматично
  -- через ON DELETE CASCADE.
  -- ----------------------------------------------------------

  delete from public.movie_activity
  where group_id = p_group_id
    and movie_id = p_movie_id
    and activity_category = 'catalog_status';


  -- ----------------------------------------------------------
  -- 5. Створюємо нову актуальну activity
  -- ----------------------------------------------------------

  insert into public.movie_activity (
    group_id,
    movie_id,
    actor_user_id,
    activity_category,
    from_status,
    to_status,
    created_at
  )
  values (
    p_group_id,
    p_movie_id,
    p_actor_user_id,
    'catalog_status',
    p_from_status,
    p_to_status,
    now()
  )
  returning id into v_activity_id;


  -- ----------------------------------------------------------
  -- 6. Snapshot recipients
  --
  -- Беремо ВСІХ поточних учасників групи:
  -- owner / member / visitor,
  -- але виключаємо автора зміни.
  -- ----------------------------------------------------------

  insert into public.movie_activity_recipients (
    activity_id,
    user_id,
    seen_at
  )
  select
    v_activity_id,
    gm.user_id,
    null
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.user_id <> p_actor_user_id;


  get diagnostics v_recipient_count = row_count;


  -- ----------------------------------------------------------
  -- 7. Якщо нікому доставляти activity — вона не потрібна
  --
  -- Наприклад: персональна група, де є тільки owner.
  -- ----------------------------------------------------------

  if v_recipient_count = 0 then

    delete from public.movie_activity
    where id = v_activity_id;

    return null;

  end if;


  return v_activity_id;

end;
$$;


/*
  Це внутрішня серверна функція.

  З app.js напряму ми її викликати не будемо,
  тому забороняємо execute клієнтським ролям.
*/

revoke execute
on function public.replace_movie_catalog_activity(
  uuid,
  uuid,
  uuid,
  text,
  text
)
from public, anon, authenticated;

/*
  Movie Wishlist
  Movie Activity — Stage 4

  Автоматично створює / замінює activity
  після INSERT або реальної зміни status
  у movie_group_lists.
*/


create or replace function public.handle_movie_group_list_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid;
begin

  /*
    Користувач, який виконав зміну через Supabase client.
  */
  v_actor_user_id := auth.uid();


  /*
    Якщо операція виконана без authenticated user,
    activity не створюємо.

    Це захищає від технічних/admin операцій,
    імпортів або SQL Editor змін.
  */
  if v_actor_user_id is null then
    return NEW;
  end if;


  /* ==========================================================
     INSERT

     Новий фільм додано до групового каталогу.
     from_status = NULL
     to_status   = NEW.status
     ========================================================== */

  if TG_OP = 'INSERT' then

    perform public.replace_movie_catalog_activity(
      NEW.group_id,
      NEW.movie_id,
      v_actor_user_id,
      null,
      NEW.status
    );

    return NEW;

  end if;


  /* ==========================================================
     UPDATE

     Activity створюємо ТІЛЬКИ якщо status реально змінився.
     Зміна purchase_url, recommended_medium, notes тощо
     не повинна породжувати activity.
     ========================================================== */

  if TG_OP = 'UPDATE'
     and OLD.status is distinct from NEW.status then

    perform public.replace_movie_catalog_activity(
      NEW.group_id,
      NEW.movie_id,
      v_actor_user_id,
      OLD.status,
      NEW.status
    );

  end if;


  return NEW;

end;
$$;


/*
  Це trigger-function.
  Клієнт напряму її не викликає.
*/

revoke execute
on function public.handle_movie_group_list_activity()
from public, anon, authenticated;
