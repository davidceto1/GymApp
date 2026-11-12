import type { AppState, Equipment, ExerciseDef, Settings, SessionExercise, Unit, Workout, WorkoutType } from '../types';
import { parseState } from '../state/storage';

/** Database rows without user_id/updated_at (added on push, ignored on pull). */
export interface UserStateRow {
  settings: Settings;
  program: AppState['program'];
  lifts: AppState['lifts'];
  next_type: WorkoutType;
  current: Workout;
}

export interface ExerciseRow {
  id: string;
  name: string;
  sets: number;
  reps: number;
  /** Null on rows written before rep ranges existed (= fixed target). */
  min_reps: number | null;
  timed: boolean;
  per_side: boolean;
  increment: number;
  equipment: Equipment;
}

function exerciseToRow(e: ExerciseDef): ExerciseRow {
  return {
    id: e.id,
    name: e.name,
    sets: e.sets,
    reps: e.reps,
    min_reps: e.minReps,
    timed: e.timed,
    per_side: e.perSide,
    increment: e.increment,
    equipment: e.equipment,
  };
}

function exerciseFromRow(r: ExerciseRow): ExerciseDef {
  return {
    id: r.id,
    name: r.name,
    sets: r.sets,
    reps: r.reps,
    minReps: r.min_reps ?? r.reps,
    timed: r.timed ?? false,
    perSide: r.per_side ?? false,
    increment: r.increment,
    equipment: r.equipment,
  };
}

export interface WorkoutRow {
  id: string;
  type: WorkoutType;
  /** Null on workouts logged before workouts had names. */
  name: string | null;
  unit: Unit;
  started_at: string | null;
  finished_at: string | null;
  exercises: SessionExercise[];
  note: string;
  body_weight: number | null;
}

/** Everything the cloud holds for one user, keyed by id for diffing. */
export interface Rows {
  userState: UserStateRow;
  exercises: Record<string, ExerciseRow>;
  workouts: Record<string, WorkoutRow>;
}

const toIso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());
const toMs = (iso: string | null) => (iso == null ? null : Date.parse(iso));

export function stateToRows(state: AppState): Rows {
  return {
    userState: {
      settings: state.settings,
      program: state.program,
      lifts: state.lifts,
      next_type: state.nextType,
      current: state.current,
    },
    exercises: Object.fromEntries(Object.values(state.exercises).map(e => [e.id, exerciseToRow(e)])),
    workouts: Object.fromEntries(
      state.history.map(w => [
        w.id,
        {
          id: w.id,
          type: w.type,
          name: w.name ?? null,
          unit: w.unit,
          started_at: toIso(w.startedAt),
          finished_at: toIso(w.finishedAt),
          exercises: w.exercises,
          note: w.note,
          body_weight: w.bodyWeight,
        },
      ]),
    ),
  };
}

export function workoutFromRow(r: WorkoutRow): Workout {
  return {
    id: r.id,
    type: r.type,
    ...(r.name != null && { name: r.name }),
    unit: r.unit,
    startedAt: toMs(r.started_at),
    finishedAt: toMs(r.finished_at),
    exercises: r.exercises,
    note: r.note ?? '',
    bodyWeight: r.body_weight,
    rest: null,
    breakDeloadHandled: true,
  };
}

const workoutTime = (w: Workout) => w.finishedAt ?? w.startedAt ?? 0;

/** Rebuild app state from database rows, validated like an imported backup. */
export function rowsToState(userState: UserStateRow, exercises: ExerciseRow[], workouts: WorkoutRow[]): AppState {
  return parseState({
    version: 2,
    settings: userState.settings,
    exercises: Object.fromEntries(exercises.map(e => [e.id, exerciseFromRow(e)])),
    program: userState.program,
    lifts: userState.lifts,
    nextType: userState.next_type,
    history: workouts.map(workoutFromRow).sort((a, b) => workoutTime(b) - workoutTime(a)),
    current: userState.current,
  });
}

/** Add local workouts the cloud doesn't have yet (first sync on a device that already has history). */
export function mergeHistory(remote: AppState, local: AppState): AppState {
  const known = new Set(remote.history.map(w => w.id));
  const extra = local.history.filter(w => !known.has(w.id));
  if (!extra.length) return remote;
  return { ...remote, history: [...remote.history, ...extra].sort((a, b) => workoutTime(b) - workoutTime(a)) };
}

export interface RowDiff {
  userState: UserStateRow | null;
  upsertExercises: ExerciseRow[];
  deleteExercises: string[];
  upsertWorkouts: WorkoutRow[];
  deleteWorkouts: string[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function diffMap<T>(prev: Record<string, T>, next: Record<string, T>) {
  return {
    upsert: Object.entries(next).filter(([id, row]) => !same(prev[id], row)).map(([, row]) => row),
    remove: Object.keys(prev).filter(id => !(id in next)),
  };
}

/** What must be written so the cloud (last known as `prev`) matches `next`. `prev` null = cloud is empty. */
export function diffRows(prev: Rows | null, next: Rows): RowDiff {
  const ex = diffMap(prev?.exercises ?? {}, next.exercises);
  const wo = diffMap(prev?.workouts ?? {}, next.workouts);
  return {
    userState: prev && same(prev.userState, next.userState) ? null : next.userState,
    upsertExercises: ex.upsert,
    deleteExercises: ex.remove,
    upsertWorkouts: wo.upsert,
    deleteWorkouts: wo.remove,
  };
}

export function isEmptyDiff(d: RowDiff): boolean {
  return !d.userState && !d.upsertExercises.length && !d.deleteExercises.length && !d.upsertWorkouts.length && !d.deleteWorkouts.length;
}
