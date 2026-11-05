import type { ExerciseDef, ExerciseId, LiftState, Settings, Unit, WorkoutType } from '../types';

export const BUILT_IN_IDS = ['squat', 'bench', 'row', 'ohp', 'deadlift'] as const;

const BUILT_IN_NAMES: Record<string, string> = {
  squat: 'Squat',
  bench: 'Bench Press',
  row: 'Barbell Row',
  ohp: 'Overhead Press',
  deadlift: 'Deadlift',
};

export const DEFAULT_PROGRAM: Record<WorkoutType, ExerciseId[]> = {
  A: ['squat', 'bench', 'row'],
  B: ['squat', 'ohp', 'deadlift'],
};

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

/** Starting weight for a new exercise: the empty bar for barbell lifts, otherwise 0. */
export function startWeight(equipment: ExerciseDef['equipment'], settings: Settings): number {
  return equipment === 'barbell' ? settings.barWeight : 0;
}
