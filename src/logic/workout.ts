import type { AppState, ExerciseId, LiftState, LoggedSet, SessionExercise, Settings, Workout, WorkoutType } from '../types';
import { PROGRAM, REPS_PER_SET, setCountFor } from './program';
import { roundLoadable } from './weights';

const DAY_MS = 24 * 60 * 60 * 1000;

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function createWorkout(
  type: WorkoutType,
  lifts: Record<ExerciseId, LiftState>,
  settings: Settings,
): Workout {
  return {
    id: newId(),
    type,
    unit: settings.unit,
    startedAt: null,
    finishedAt: null,
    exercises: PROGRAM[type].map(id => ({
      id,
      weight: lifts[id].weight,
      sets: Array.from({ length: setCountFor(id, settings.program) }, () => ({
        target: REPS_PER_SET,
        reps: null,
      })),
    })),
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
  lift: LiftState,
  ex: SessionExercise,
  settings: Settings,
): LiftState {
  const outcome = exerciseOutcome(ex);
  if (outcome === 'skipped') return lift;
  if (outcome === 'success') {
    return { weight: ex.weight + settings.increments[ex.id], failures: 0 };
  }
  const failures = (ex.weight === lift.weight ? lift.failures : 0) + 1;
  if (failures >= settings.failuresBeforeDeload) {
    return {
      weight: roundLoadable(ex.weight * (1 - settings.deloadPercent / 100), settings),
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
    lifts[ex.id] = progressLift(lifts[ex.id], ex, settings);
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
    current: createWorkout(nextType, lifts, settings),
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

export function applyDeloadToWorkout(workout: Workout, percent: number, settings: Settings): Workout {
  return {
    ...workout,
    exercises: workout.exercises.map(ex => ({
      ...ex,
      weight: roundLoadable(ex.weight * (1 - percent / 100), settings),
    })),
  };
}

export function restTarget(settings: Settings, failed: boolean): number {
  return failed ? settings.restFailed : settings.restEasy;
}
