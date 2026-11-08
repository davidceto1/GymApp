-- Rep ranges (double progression), timed sets and per-side sets.
-- min_reps stays nullable: null means a fixed target equal to reps, which is how
-- rows written before this migration (and by older app versions) are read.

alter table public.exercises
  add column min_reps integer,
  add column timed    boolean not null default false,
  add column per_side boolean not null default false,
  add constraint exercises_min_reps_range check (min_reps is null or (min_reps > 0 and min_reps <= reps));
