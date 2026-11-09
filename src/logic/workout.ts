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
        const min = Math.min(def.minReps ?? def.reps, def.reps);
        return {
          id,
          name: def.name,
          equipment: def.equipment,
          ...(def.timed && { timed: true }),
          ...(def.perSide && { perSide: true }),
          weight: lifts[id]?.weight ?? startWeight(def.equipment, settings),
          sets: Array.from({ length: def.sets }, () =>
            min < def.reps ? { target: def.reps, min, reps: null } : { target: def.reps, reps: null },
          ),
        };
      }),
    note: '',
    bodyWeight: null,
    rest: null,
    breakDeloadHandled: false,
  };
}

/** Seconds removed per tap on a timed set. */
export const TIMED_STEP = 5;

/** Tap cycle: empty → target → target−step → … → 0 → empty. */
export function nextReps(set: LoggedSet, step = 1): number | null {
  if (set.reps === null) return set.target;
  if (set.reps === 0) return null;
  return Math.max(0, set.reps - step);
}

/** Bottom of a set's range; older workouts only stored the target. */
export function setMin(set: LoggedSet): number {
  return Math.min(set.min ?? set.target, set.target);
}

/** Logged below the bottom of the range. */
export function isSetFailed(set: LoggedSet): boolean {
  return set.reps !== null && set.reps < setMin(set);
}

/**
 * success: every set hit the top of the range (time to add weight).
 * progress: every set landed inside the range (keep the weight, build reps).
 * failed: a set fell below the range or was left unlogged.
 */
export type ExerciseOutcome = 'success' | 'progress' | 'failed' | 'skipped';

export function exerciseOutcome(ex: SessionExercise): ExerciseOutcome {
  if (ex.sets.every(s => s.reps === null)) return 'skipped';
  if (ex.sets.every(s => s.reps !== null && s.reps >= s.target)) return 'success';
  return ex.sets.every(s => s.reps !== null && s.reps >= setMin(s)) ? 'progress' : 'failed';
}

export function totalReps(ex: SessionExercise): number {
  return ex.sets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
}

export function hasLoggedSets(workout: Workout): boolean {
  return workout.exercises.some(ex => ex.sets.some(s => s.reps !== null));
}

export function isWorkoutComplete(workout: Workout): boolean {
  return workout.exercises.every(ex => ex.sets.every(s => s.reps !== null));
}

/**
 * Compute next-session lift state for one exercise (double progression):
 * top of the range on every set → add weight; inside the range with more total reps than
 * before at this weight → keep the weight; otherwise the session counts as a stall, and
 * `failuresBeforeDeload` stalls in a row drop the weight by `deloadPercent`.
 */
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
  const sameWeight = lift != null && ex.weight === lift.weight;
  const best = sameWeight ? lift.bestReps : undefined;
  const total = totalReps(ex);
  const improved = outcome === 'progress' && (best == null || total > best);
  const bestReps = outcome === 'progress' ? Math.max(best ?? 0, total) : best;
  if (improved) return { weight: ex.weight, failures: 0, bestReps };
  const failures = (sameWeight ? lift.failures : 0) + 1;
  if (failures >= settings.failuresBeforeDeload) {
    return {
      weight: roundForExercise(ex.weight * (1 - settings.deloadPercent / 100), def.equipment, def.increment, settings),
      failures: 0,
    };
  }
  return bestReps == null ? { weight: ex.weight, failures } : { weight: ex.weight, failures, bestReps };
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
