import type { LiftState, SessionExercise, Workout } from '../types';
import { convertWeight } from './weights';
import { exerciseOutcome, totalReps, type ExerciseOutcome } from './workout';

const EPS = 1e-6;

export type RecordKind = 'weight' | 'reps';

export interface ExerciseSummary {
  exercise: SessionExercise;
  outcome: ExerciseOutcome;
  /** 'weight': heaviest weight ever lifted; 'reps': most total reps/seconds at your best weight. */
  record: RecordKind | null;
  /** Previous best weight (in the workout's unit), when there was one. */
  previousBest: number | null;
  /** Working weight for the next session, when the lift is tracked. */
  nextWeight: number | null;
}

export interface WorkoutSummary {
  workout: Workout;
  durationSec: number | null;
  setsLogged: number;
  setsTotal: number;
  /** Sum of weight × reps over logged sets (timed and bodyweight work counts as 0). */
  volume: number;
  exercises: ExerciseSummary[];
  records: number;
}

const lifted = (ex: SessionExercise) => ex.sets.some(s => (s.reps ?? 0) > 0);

/**
 * Summarise a finished workout against the workouts before it.
 * `earlier` is the history older than `workout` (newest first, as stored).
 */
export function summarizeWorkout(
  workout: Workout,
  earlier: Workout[],
  lifts: Record<string, LiftState>,
): WorkoutSummary {
  const exercises = workout.exercises.map((ex): ExerciseSummary => {
    const outcome = exerciseOutcome(ex);
    let best: number | null = null;
    let bestReps = 0;
    for (const w of earlier) {
      for (const prev of w.exercises) {
        if (prev.id !== ex.id || !lifted(prev)) continue;
        const weight = convertWeight(prev.weight, w.unit, workout.unit);
        const reps = totalReps(prev);
        if (best == null || weight > best + EPS) {
          best = weight;
          bestReps = reps;
        } else if (Math.abs(weight - best) <= EPS) {
          bestReps = Math.max(bestReps, reps);
        }
      }
    }

    let record: RecordKind | null = null;
    if (best != null && lifted(ex)) {
      if (ex.weight > best + EPS) record = 'weight';
      else if (Math.abs(ex.weight - best) <= EPS && totalReps(ex) > bestReps) record = 'reps';
    }

    return {
      exercise: ex,
      outcome,
      record,
      previousBest: best,
      nextWeight: lifts[ex.id]?.weight ?? null,
    };
  });

  let setsLogged = 0;
  let setsTotal = 0;
  let volume = 0;
  for (const ex of workout.exercises) {
    for (const s of ex.sets) {
      setsTotal++;
      if (s.reps == null) continue;
      setsLogged++;
      if (!ex.timed) volume += ex.weight * s.reps;
    }
  }

  return {
    workout,
    durationSec:
      workout.startedAt != null && workout.finishedAt != null
        ? Math.max(0, (workout.finishedAt - workout.startedAt) / 1000)
        : null,
    setsLogged,
    setsTotal,
    volume: Math.round(volume),
    exercises,
    records: exercises.filter(e => e.record).length,
  };
}
