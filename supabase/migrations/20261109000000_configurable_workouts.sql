-- Configurable workouts: the program is a list of 1–5 named workouts ('A'–'E') instead of
-- fixed A/B. user_state.program now holds [{ id, name, exercises }] (the app still reads
-- the old { A, B } shape). Workout ids are no longer limited to 'A'/'B', and each logged
-- workout keeps a snapshot of its name so history still reads well after a rename.

alter table public.user_state drop constraint if exists user_state_next_type_check;
alter table public.workouts   drop constraint if exists workouts_type_check;

alter table public.workouts add column name text;
