import type { AppState, ExerciseDef, Workout } from '../types';
import { BUILT_IN_IDS, DEFAULT_PROGRAM, builtInName, defaultExercises, defaultSettings } from '../logic/program';
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
    (v.type === 'A' || v.type === 'B') &&
    Array.isArray(v.exercises) &&
    v.exercises.every(
      e => isObject(e) && typeof e.id === 'string' && typeof e.weight === 'number' && Array.isArray(e.sets),
    )
  );
}

/** Fill in fields added after a workout was saved (name/equipment snapshots). */
function upgradeWorkout(w: Obj, exercises: Record<string, ExerciseDef>): Workout {
  return {
    ...(w as unknown as Workout),
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
    program: { A: [...DEFAULT_PROGRAM.A], B: [...DEFAULT_PROGRAM.B] },
  };
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
  const program = raw.program;
  if (
    !isObject(program) ||
    !(['A', 'B'] as const).every(t => Array.isArray(program[t]) && (program[t] as unknown[]).length > 0 && (program[t] as unknown[]).every(id => typeof id === 'string' && exercises[id as string]))
  ) {
    throw new Error('Backup workouts are malformed.');
  }
  if (!isObject(raw.lifts) || !Object.values(raw.lifts).every(l => isObject(l) && typeof l.weight === 'number')) {
    throw new Error('Backup is missing lift data.');
  }
  if (!Array.isArray(raw.history) || !raw.history.every(isWorkout)) {
    throw new Error('Backup history is malformed.');
  }
  if (!isWorkout(raw.current)) throw new Error('Backup current workout is malformed.');

  const unit = isObject(raw.settings) && raw.settings.unit === 'lb' ? 'lb' : 'kg';
  return {
    ...(raw as unknown as AppState),
    version: 2,
    // Fill in any settings added after the backup was made.
    settings: { ...defaultSettings(unit), ...(isObject(raw.settings) ? raw.settings : {}) },
    exercises,
    history: (raw.history as Obj[]).map(w => upgradeWorkout(w, exercises)),
    current: upgradeWorkout(raw.current as Obj, exercises),
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
        w.type,
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
