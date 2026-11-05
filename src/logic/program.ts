import type { ExerciseId, ProgramVariant, Settings, Unit, WorkoutType, LiftState } from '../types';

export const EXERCISE_NAMES: Record<ExerciseId, string> = {
  squat: 'Squat',
  bench: 'Bench Press',
  row: 'Barbell Row',
  ohp: 'Overhead Press',
  deadlift: 'Deadlift',
};

export const EXERCISE_IDS: ExerciseId[] = ['squat', 'bench', 'row', 'ohp', 'deadlift'];

export const PROGRAM: Record<WorkoutType, ExerciseId[]> = {
  A: ['squat', 'bench', 'row'],
  B: ['squat', 'ohp', 'deadlift'],
};

export const REPS_PER_SET = 5;

/** Deadlift is always 1×5; everything else follows the chosen variant. */
export function setCountFor(id: ExerciseId, program: ProgramVariant): number {
  if (id === 'deadlift') return 1;
  return program === '5x5' ? 5 : 3;
}

const START_WEIGHTS: Record<Unit, Record<ExerciseId, number>> = {
  kg: { squat: 20, bench: 20, row: 30, ohp: 20, deadlift: 40 },
  lb: { squat: 45, bench: 45, row: 65, ohp: 45, deadlift: 95 },
};

export function unitDefaults(unit: Unit): Pick<Settings, 'barWeight' | 'plates' | 'increments'> {
  if (unit === 'kg') {
    return {
      barWeight: 20,
      plates: [25, 20, 15, 10, 5, 2.5, 1.25],
      increments: { squat: 2.5, bench: 2.5, row: 2.5, ohp: 2.5, deadlift: 5 },
    };
  }
  return {
    barWeight: 45,
    plates: [45, 35, 25, 10, 5, 2.5],
    increments: { squat: 5, bench: 5, row: 5, ohp: 5, deadlift: 10 },
  };
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
    program: '5x5',
    sound: true,
  };
}

export function defaultLifts(unit: Unit = 'kg'): Record<ExerciseId, LiftState> {
  const w = START_WEIGHTS[unit];
  return Object.fromEntries(
    EXERCISE_IDS.map(id => [id, { weight: w[id], failures: 0 }]),
  ) as Record<ExerciseId, LiftState>;
}
