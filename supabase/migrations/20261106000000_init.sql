-- GymApp cloud sync schema.
-- Every row belongs to an auth user; row-level security keeps users' data apart,
-- so the same schema works for one user now and many later.

-- Settings, program order, per-lift working weights and the in-progress workout.
create table public.user_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  settings   jsonb not null,
  program    jsonb not null,
  lifts      jsonb not null,
  next_type  text  not null check (next_type in ('A', 'B')),
  current    jsonb not null,
  updated_at timestamptz not null default now()
);

-- Exercise library (built-in and custom exercises).
create table public.exercises (
  user_id   uuid not null references auth.users (id) on delete cascade,
  id        text not null,
  name      text not null,
  sets      integer not null check (sets > 0),
  reps      integer not null check (reps > 0),
  increment double precision not null,
  equipment text not null check (equipment in ('barbell', 'other')),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Finished workouts (history). Sets are stored per exercise as jsonb:
-- [{ id, name, equipment, weight, sets: [{ target, reps }] }]
create table public.workouts (
  user_id     uuid not null references auth.users (id) on delete cascade,
  id          text not null,
  type        text not null check (type in ('A', 'B')),
  unit        text not null check (unit in ('kg', 'lb')),
  started_at  timestamptz,
  finished_at timestamptz,
  exercises   jsonb not null,
  note        text not null default '',
  body_weight double precision,
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create index workouts_user_finished_idx on public.workouts (user_id, finished_at desc);

-- Keep updated_at current on every write.
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger user_state_touch before update on public.user_state
  for each row execute function public.touch_updated_at();
create trigger exercises_touch before update on public.exercises
  for each row execute function public.touch_updated_at();
create trigger workouts_touch before update on public.workouts
  for each row execute function public.touch_updated_at();

-- Row-level security: a user can only see and change their own rows.
alter table public.user_state enable row level security;
alter table public.exercises  enable row level security;
alter table public.workouts   enable row level security;

create policy "own user_state" on public.user_state
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own exercises" on public.exercises
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own workouts" on public.workouts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
