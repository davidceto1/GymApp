import type { AppState, ExerciseDef, Workout, WorkoutDef } from '../types';
import {
  BUILT_IN_IDS,
  MAX_WORKOUTS,
  builtInName,
  defaultExercises,
  defaultProgram,
  defaultSettings,
  findWorkoutDef,
  workoutLabel,
} from '../logic/program';
import { formatWeight } from '../logic/weights';
import { initialState } from './reducer';

export const STORAGE_KEY = 'stronglifts-remake-v1';

type Obj = Record<string, unknown>;

function isObject(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isWorkout(v: unknown): boolean {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.type === 'string' &&
    v.type !== '' &&
    (v.name === undefined || v.name === null || typeof v.name === 'string') &&
    Array.isArray(v.exercises) &&
    v.exercises.every(
      e => isObject(e) && typeof e.id === 'string' && typeof e.weight === 'number' && Array.isArray(e.sets),
    )
  );
}

/** Fill in fields added after a workout was saved (name/equipment snapshots). */
function upgradeWorkout(w: Obj, exercises: Record<string, ExerciseDef>): Workout {
  const workout = { ...(w as unknown as Workout) };
  if (typeof w.name !== 'string') delete workout.name;
  return {
    ...workout,
    exercises: (w.exercises as Obj[]).map(e => ({
      ...(e as unknown as Workout['exercises'][number]),
      name: typeof e.name === 'string' ? e.name : exercises[e.id as string]?.name ?? builtInName(e.id as string),
      equipment: e.equipment === 'other' ? 'other' : 'barbell',
    })),
  };
}

/** Version 1 had five fixed lifts with increments/program variant stored in settings. */
function migrateV1(raw: Obj): Obj {
  const settings = isObject(raw.settings) ? raw.settings : {};
  const unit = settings.unit === 'lb' ? 'lb' : 'kg';
  const exercises = defaultExercises(unit);
  const increments = isObject(settings.increments) ? settings.increments : {};
  for (const id of BUILT_IN_IDS) {
    if (typeof increments[id] === 'number') exercises[id].increment = increments[id] as number;
    if (settings.program === '3x5' && id !== 'deadlift') exercises[id].sets = 3;
  }
  const rest = { ...settings };
  delete rest.increments;
  delete rest.program;
  return {
    ...raw,
    version: 2,
    settings: rest,
    exercises,
    program: defaultProgram(),
  };
}

/**
 * The program as a list of 1–5 workouts. Data saved before workouts were configurable
 * stores it as `{ A: [...ids], B: [...ids] }`.
 */
function parseProgram(program: unknown, exercises: Record<string, ExerciseDef>): WorkoutDef[] | null {
  const list: unknown[] | null = Array.isArray(program)
    ? program
    : isObject(program)
      ? (['A', 'B'] as const).map(id => ({ id, name: `Workout ${id}`, exercises: program[id] }))
      : null;
  if (!list || list.length < 1 || list.length > MAX_WORKOUTS) return null;
  const ok = list.every(
    w =>
      isObject(w) &&
      typeof w.id === 'string' &&
      w.id !== '' &&
      typeof w.name === 'string' &&
      Array.isArray(w.exercises) &&
      w.exercises.every(id => typeof id === 'string' && exercises[id]),
  );
  const ids = list.map(w => (w as Obj).id);
  if (!ok || new Set(ids).size !== ids.length) return null;
  return (list as Obj[]).map(w => ({ id: w.id as string, name: w.name as string, exercises: [...(w.exercises as string[])] }));
}

/** Validate untrusted data (localStorage or an imported backup) and upgrade old versions. */
export function parseState(input: unknown): AppState {
  if (!isObject(input) || (input.version !== 1 && input.version !== 2)) {
    throw new Error('Not a StrongLifts backup (unknown version).');
  }
  const raw = input.version === 1 ? migrateV1(input) : input;

  if (!isObject(raw.exercises) || !Object.values(raw.exercises).every(
    d => isObject(d) && typeof d.id === 'string' && typeof d.name === 'string' && typeof d.sets === 'number' && typeof d.reps === 'number',
  )) {
    throw new Error('Backup exercise list is malformed.');
  }
  // Rep ranges, timed and per-side sets were added later: older data has a fixed target.
  const exercises: Record<string, ExerciseDef> = Object.fromEntries(
    Object.entries(raw.exercises as Record<string, Obj>).map(([id, d]) => {
      const reps = d.reps as number;
      const min = typeof d.minReps === 'number' && d.minReps >= 1 ? Math.min(d.minReps, reps) : reps;
      return [id, { ...(d as unknown as ExerciseDef), minReps: min, timed: d.timed === true, perSide: d.perSide === true }];
    }),
  );
  const program = parseProgram(raw.program, exercises);
  if (!program) throw new Error('Backup workouts are malformed.');
  if (!isObject(raw.lifts) || !Object.values(raw.lifts).every(l => isObject(l) && typeof l.weight === 'number')) {
    throw new Error('Backup is missing lift data.');
  }
  if (!Array.isArray(raw.history) || !raw.history.every(isWorkout)) {
    throw new Error('Backup history is malformed.');
  }
  if (!isWorkout(raw.current)) throw new Error('Backup current workout is malformed.');

  const unit = isObject(raw.settings) && raw.settings.unit === 'lb' ? 'lb' : 'kg';
  const current = upgradeWorkout(raw.current as Obj, exercises);
  const currentDef = findWorkoutDef(program, current.type);
  if (current.name === undefined && currentDef) current.name = currentDef.name;
  const nextType =
    typeof raw.nextType === 'string' && findWorkoutDef(program, raw.nextType) ? raw.nextType : (currentDef ?? program[0]).id;
  return {
    ...(raw as unknown as AppState),
    version: 2,
    // Fill in any settings added after the backup was made.
    settings: { ...defaultSettings(unit), ...(isObject(raw.settings) ? raw.settings : {}) },
    exercises,
    program,
    nextType,
    history: (raw.history as Obj[]).map(w => upgradeWorkout(w, exercises)),
    current,
  };
}

export function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return parseState(JSON.parse(stored));
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return initialState();
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked; nothing sensible to do.
  }
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function historyToCsv(history: Workout[]): string {
  const rows = [['Date', 'Workout', 'Exercise', 'Weight', 'Unit', 'Reps', 'Body Weight', 'Note']];
  for (const w of [...history].reverse()) {
    const date = new Date(w.finishedAt ?? w.startedAt ?? 0).toISOString().slice(0, 10);
    for (const ex of w.exercises) {
      rows.push([
        date,
        workoutLabel(w),
        ex.name,
        formatWeight(ex.weight),
        w.unit,
        ex.sets.map(s => (s.reps === null ? '-' : String(s.reps))).join('/'),
        w.bodyWeight == null ? '' : formatWeight(w.bodyWeight),
        w.note,
      ]);
    }
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
}
