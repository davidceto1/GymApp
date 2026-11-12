import type { ExerciseDef, ExerciseId, LiftState, Settings, Unit, Workout, WorkoutDef, WorkoutType } from '../types';

export const BUILT_IN_IDS = ['squat', 'bench', 'row', 'ohp', 'deadlift'] as const;

const BUILT_IN_NAMES: Record<string, string> = {
  squat: 'Squat',
  bench: 'Bench Press',
  row: 'Barbell Row',
  ohp: 'Overhead Press',
  deadlift: 'Deadlift',
};

/** Workout ids, in the order new workouts get them. */
export const WORKOUT_IDS = ['A', 'B', 'C', 'D', 'E'] as const;
export const MAX_WORKOUTS = WORKOUT_IDS.length;

/** StrongLifts: Workout A and Workout B, alternating. */
export function defaultProgram(): WorkoutDef[] {
  return [
    { id: 'A', name: 'Workout A', exercises: ['squat', 'bench', 'row'] },
    { id: 'B', name: 'Workout B', exercises: ['squat', 'ohp', 'deadlift'] },
  ];
}

export function findWorkoutDef(program: WorkoutDef[], id: WorkoutType): WorkoutDef | undefined {
  return program.find(w => w.id === id);
}

/** The workout after `id` in the rotation (wrapping); the first one if `id` isn't in the program. */
export function nextWorkoutId(program: WorkoutDef[], id: WorkoutType): WorkoutType {
  const i = program.findIndex(w => w.id === id);
  return program[(i + 1) % program.length].id;
}

/** First id in A–E that no workout uses yet, or null when the program is full. */
export function unusedWorkoutId(program: WorkoutDef[]): WorkoutType | null {
  return WORKOUT_IDS.find(id => !program.some(w => w.id === id)) ?? null;
}

/** Display name of a logged or in-progress workout. */
export function workoutLabel(w: Pick<Workout, 'type' | 'name'>): string {
  return w.name?.trim() || `Workout ${w.type}`;
}

/** Name of a workout in the program by id. */
export function workoutDefName(program: WorkoutDef[], id: WorkoutType): string {
  return findWorkoutDef(program, id)?.name.trim() || `Workout ${id}`;
}

/** Ids of every exercise used by any workout in the program. */
export function programExerciseIds(program: WorkoutDef[]): Set<ExerciseId> {
  return new Set(program.flatMap(w => w.exercises));
}

export const REPS_PER_SET = 5;

export function isBuiltIn(id: ExerciseId): boolean {
  return (BUILT_IN_IDS as readonly string[]).includes(id);
}

export function builtInName(id: ExerciseId): string {
  return BUILT_IN_NAMES[id] ?? id;
}

const START_WEIGHTS: Record<Unit, Record<string, number>> = {
  kg: { squat: 20, bench: 20, row: 30, ohp: 20, deadlift: 40 },
  lb: { squat: 45, bench: 45, row: 65, ohp: 45, deadlift: 95 },
};

/** Default increment for a lift: 2.5 kg / 5 lb, doubled for deadlift. */
export function defaultIncrement(id: ExerciseId, unit: Unit): number {
  const base = unit === 'kg' ? 2.5 : 5;
  return id === 'deadlift' ? base * 2 : base;
}

export function defaultExercises(unit: Unit = 'kg'): Record<ExerciseId, ExerciseDef> {
  return Object.fromEntries(
    BUILT_IN_IDS.map(id => [
      id,
      {
        id,
        name: BUILT_IN_NAMES[id],
        sets: id === 'deadlift' ? 1 : 5,
        reps: REPS_PER_SET,
        minReps: REPS_PER_SET,
        timed: false,
        perSide: false,
        increment: defaultIncrement(id, unit),
        equipment: 'barbell',
      } satisfies ExerciseDef,
    ]),
  );
}

export function unitDefaults(unit: Unit): Pick<Settings, 'barWeight' | 'plates'> {
  return unit === 'kg'
    ? { barWeight: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] }
    : { barWeight: 45, plates: [45, 35, 25, 10, 5, 2.5] };
}

export function defaultSettings(unit: Unit = 'kg'): Settings {
  return {
    unit,
    ...unitDefaults(unit),
    restEasy: 90,
    restHard: 180,
    restFailed: 300,
    deloadPercent: 10,
    failuresBeforeDeload: 3,
    sound: true,
  };
}

export function defaultLifts(unit: Unit = 'kg'): Record<ExerciseId, LiftState> {
  const w = START_WEIGHTS[unit];
  return Object.fromEntries(BUILT_IN_IDS.map(id => [id, { weight: w[id], failures: 0 }]));
}

/** "6–8", "30s", "8/side", "20–30s/side". `min` defaults to `max` (fixed target). */
export function formatTarget(max: number, min = max, opts: { timed?: boolean; perSide?: boolean } = {}): string {
  const range = min < max ? `${min}–${max}` : `${max}`;
  return `${range}${opts.timed ? 's' : ''}${opts.perSide ? '/side' : ''}`;
}

/** "3×6–8" for an exercise definition. */
export function formatScheme(def: Pick<ExerciseDef, 'sets' | 'reps' | 'minReps' | 'timed' | 'perSide'>): string {
  return `${def.sets}×${formatTarget(def.reps, def.minReps, def)}`;
}

/** Starting weight for a new exercise: the empty bar for barbell lifts, otherwise 0. */
export function startWeight(equipment: ExerciseDef['equipment'], settings: Settings): number {
  return equipment === 'barbell' ? settings.barWeight : 0;
}
