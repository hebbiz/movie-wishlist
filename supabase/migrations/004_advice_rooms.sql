-- Create advice rooms table

create table advice_rooms (
    id uuid primary key default gen_random_uuid(),

    movie_id uuid not null
        references movies(id)
        on delete cascade,

    group_id uuid not null
        references groups(id)
        on delete cascade,

    created_by uuid not null
        references auth.users(id),

    status text not null
        check (status in ('waiting','discussion','summarizing','closed')),

    opened_at timestamptz not null default now(),

    expires_at timestamptz not null,

    closed_at timestamptz,

    result_generated boolean not null default false
);
