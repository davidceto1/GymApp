import type {
  AppState,
  Equipment,
  ExerciseDef,
  LiftState,
  LoggedSet,
  SessionExercise,
  Settings,
  Workout,
  WorkoutType,
} from '../types';
import { startWeight } from './program';
import { roundLoadable, roundTo } from './weights';

const DAY_MS = 24 * 60 * 60 * 1000;

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

type ProgramState = Pick<AppState, 'program' | 'exercises' | 'lifts' | 'settings'>;

/** Round to a weight you can actually use: plate-loadable for barbells, the increment otherwise. */
export function roundForExercise(
  value: number,
  equipment: Equipment,
  increment: number,
  settings: Settings,
): number {
  if (equipment === 'barbell') return roundLoadable(value, settings);
  return Math.max(0, roundTo(value, increment > 0 ? increment : 1));
}

export function createWorkout(type: WorkoutType, state: ProgramState): Workout {
  const { program, exercises, lifts, settings } = state;
  return {
    id: newId(),
    type,
    unit: settings.unit,
    startedAt: null,
    finishedAt: null,
    exercises: program[type]
      .filter(id => exercises[id])
      .map(id => {
        const def = exercises[id];
        return {
          id,
          name: def.name,
          equipment: def.equipment,
          weight: lifts[id]?.weight ?? startWeight(def.equipment, settings),
          sets: Array.from({ length: def.sets }, () => ({ target: def.reps, reps: null })),
        };
      }),
    note: '',
    bodyWeight: null,
    rest: null,
    breakDeloadHandled: false,
  };
}

/** Tap cycle: empty → target → target−1 → … → 0 → empty. */
export function nextReps(set: LoggedSet): number | null {
  if (set.reps === null) return set.target;
  if (set.reps === 0) return null;
  return set.reps - 1;
}

export function isSetFailed(set: LoggedSet): boolean {
  return set.reps !== null && set.reps < set.target;
}

export type ExerciseOutcome = 'success' | 'failed' | 'skipped';

export function exerciseOutcome(ex: SessionExercise): ExerciseOutcome {
  if (ex.sets.every(s => s.reps === null)) return 'skipped';
  return ex.sets.every(s => s.reps !== null && s.reps >= s.target) ? 'success' : 'failed';
}

export function hasLoggedSets(workout: Workout): boolean {
  return workout.exercises.some(ex => ex.sets.some(s => s.reps !== null));
}

export function isWorkoutComplete(workout: Workout): boolean {
  return workout.exercises.every(ex => ex.sets.every(s => s.reps !== null));
}

/** Compute next-session lift state for one exercise. */
export function progressLift(
  lift: LiftState | undefined,
  ex: SessionExercise,
  def: ExerciseDef,
  settings: Settings,
): LiftState | undefined {
  const outcome = exerciseOutcome(ex);
  if (outcome === 'skipped') return lift;
  if (outcome === 'success') {
    return { weight: ex.weight + def.increment, failures: 0 };
  }
  const failures = (lift && ex.weight === lift.weight ? lift.failures : 0) + 1;
  if (failures >= settings.failuresBeforeDeload) {
    return {
      weight: roundForExercise(ex.weight * (1 - settings.deloadPercent / 100), def.equipment, def.increment, settings),
      failures: 0,
    };
  }
  return { weight: ex.weight, failures };
}

export function finishWorkout(state: AppState, now: number): AppState {
  const { current, settings } = state;
  if (!hasLoggedSets(current)) return state;
  const lifts = { ...state.lifts };
  for (const ex of current.exercises) {
    const def = state.exercises[ex.id];
    if (!def) continue;
    const next = progressLift(lifts[ex.id], ex, def, settings);
    if (next) lifts[ex.id] = next;
  }
  const finished: Workout = {
    ...current,
    startedAt: current.startedAt ?? now,
    finishedAt: now,
    rest: null,
  };
  const nextType: WorkoutType = current.type === 'A' ? 'B' : 'A';
  return {
    ...state,
    lifts,
    nextType,
    history: [finished, ...state.history],
    current: createWorkout(nextType, { ...state, lifts }),
  };
}

export function daysSinceLastWorkout(history: Workout[], now: number): number | null {
  const last = history[0]?.finishedAt;
  if (last == null) return null;
  return Math.floor((now - last) / DAY_MS);
}

/** 10% per full two weeks off, capped at 30%. */
export function breakDeloadPercent(days: number | null): number {
  if (days == null || days < 14) return 0;
  return Math.min(30, Math.floor(days / 14) * 10);
}
