import { describe, it, expect } from 'vitest';
import { DEFAULT_PROGRAM, defaultExercises, defaultLifts, defaultSettings, formatScheme } from './program';
import {
  convertWeight,
  plateBreakdown,
  roundLoadable,
  warmupSets,
} from './weights';
import {
  breakDeloadPercent,
  createWorkout,
  daysSinceLastWorkout,
  exerciseOutcome,
  nextReps,
  progressLift,
  roundForExercise,
  TIMED_STEP,
} from './workout';
import type { ExerciseDef, SessionExercise } from '../types';

const kg = defaultSettings('kg');
const defs = defaultExercises('kg');
const programState = { program: DEFAULT_PROGRAM, exercises: defs, lifts: defaultLifts('kg'), settings: kg };

function ex(id: string, weight: number, reps: (number | null)[]): SessionExercise {
  return { id, name: id, equipment: 'barbell', weight, sets: reps.map(r => ({ target: 5, reps: r })) };
}

const dips: ExerciseDef = { id: 'dips', name: 'Dips', sets: 3, reps: 8, minReps: 8, timed: false, perSide: false, increment: 2, equipment: 'other' };

describe('program', () => {
  it('builds workout A as squat/bench/row 5×5', () => {
    const w = createWorkout('A', programState);
    expect(w.exercises.map(e => e.id)).toEqual(['squat', 'bench', 'row']);
    expect(w.exercises.map(e => e.name)).toEqual(['Squat', 'Bench Press', 'Barbell Row']);
    expect(w.exercises.every(e => e.sets.length === 5 && e.sets.every(s => s.target === 5))).toBe(true);
  });

  it('builds workout B with deadlift 1×5', () => {
    const w = createWorkout('B', programState);
    expect(w.exercises.map(e => e.id)).toEqual(['squat', 'ohp', 'deadlift']);
    expect(w.exercises[2].sets).toHaveLength(1);
  });

  it('uses StrongLifts starting weights', () => {
    expect(defaultLifts('kg')).toMatchObject({
      squat: { weight: 20 }, bench: { weight: 20 }, row: { weight: 30 }, ohp: { weight: 20 }, deadlift: { weight: 40 },
    });
    expect(defaultLifts('lb').squat.weight).toBe(45);
  });

  it('builds custom workouts with per-exercise sets and reps', () => {
    const w = createWorkout('A', {
      ...programState,
      exercises: { ...defs, dips },
      program: { A: ['dips', 'squat'], B: ['deadlift'] },
    });
    expect(w.exercises.map(e => e.id)).toEqual(['dips', 'squat']);
    expect(w.exercises[0]).toMatchObject({ name: 'Dips', equipment: 'other', weight: 0 });
    expect(w.exercises[0].sets).toEqual(Array(3).fill({ target: 8, reps: null }));
  });

  it('skips program entries whose exercise no longer exists', () => {
    const w = createWorkout('A', { ...programState, program: { A: ['gone', 'squat'], B: ['squat'] } });
    expect(w.exercises.map(e => e.id)).toEqual(['squat']);
  });
});

describe('set tapping', () => {
  it('cycles empty → 5 → 4 → … → 0 → empty', () => {
    const seen: (number | null)[] = [];
    let set = { target: 5, reps: null as number | null };
    for (let i = 0; i < 7; i++) {
      set = { ...set, reps: nextReps(set) };
      seen.push(set.reps);
    }
    expect(seen).toEqual([5, 4, 3, 2, 1, 0, null]);
  });
});

describe('progression', () => {
  it('adds the increment after a successful session', () => {
    const lift = { weight: 60, failures: 0 };
    expect(progressLift(lift, ex('squat', 60, [5, 5, 5, 5, 5]), defs.squat, kg)).toEqual({ weight: 62.5, failures: 0 });
    expect(progressLift({ weight: 100, failures: 0 }, ex('deadlift', 100, [5]), defs.deadlift, kg)?.weight).toBe(105);
  });

  it('repeats the weight after a failed session', () => {
    expect(progressLift({ weight: 60, failures: 0 }, ex('bench', 60, [5, 5, 5, 4, 3]), defs.bench, kg)).toEqual({ weight: 60, failures: 1 });
  });

  it('deloads 10% after the third consecutive failure, rounded to plates', () => {
    expect(progressLift({ weight: 62.5, failures: 2 }, ex('bench', 62.5, [5, 5, 4, 4, 4]), defs.bench, kg)).toEqual({ weight: 57.5, failures: 0 });
  });

  it('resets the failure count when the weight was changed manually', () => {
    expect(progressLift({ weight: 60, failures: 2 }, ex('bench', 55, [5, 4, 4, 4, 4]), defs.bench, kg)).toEqual({ weight: 55, failures: 1 });
  });

  it('treats unlogged exercises as skipped and partially logged as failed', () => {
    expect(exerciseOutcome(ex('row', 40, [null, null, null, null, null]))).toBe('skipped');
    expect(exerciseOutcome(ex('row', 40, [5, 5, null, null, null]))).toBe('failed');
    const lift = { weight: 40, failures: 1 };
    expect(progressLift(lift, ex('row', 40, [null, null, null, null, null]), defs.row, kg)).toBe(lift);
  });

  it('never deloads below the empty bar', () => {
    expect(progressLift({ weight: 20, failures: 2 }, ex('ohp', 20, [3, 3, 3, 3, 3]), defs.ohp, kg)?.weight).toBe(20);
  });

  it('progresses and deloads non-barbell exercises by their own increment', () => {
    const session = { ...ex('dips', 10, [8, 8, 8]), equipment: 'other' as const };
    session.sets = session.sets.map(s => ({ ...s, target: 8 }));
    expect(progressLift({ weight: 10, failures: 0 }, session, dips, kg)).toEqual({ weight: 12, failures: 0 });
    const failed = { ...session, sets: session.sets.map(s => ({ ...s, reps: 6 })) };
    // 10 × 0.9 = 9, which rounds to the nearest 2 kg step: 10.
    expect(progressLift({ weight: 10, failures: 2 }, failed, dips, kg)).toEqual({ weight: 10, failures: 0 });
    expect(roundForExercise(8.6, 'other', 2, kg)).toBe(8);
    expect(roundForExercise(-3, 'other', 2, kg)).toBe(0);
    expect(roundForExercise(8.6, 'barbell', 2, kg)).toBe(20);
  });
});

describe('rep ranges (double progression)', () => {
  // 3×6–8 dumbbell bench, +2 kg once every set hits 8.
  const press: ExerciseDef = { id: 'press', name: 'DB Bench', sets: 3, reps: 8, minReps: 6, timed: false, perSide: false, increment: 2, equipment: 'other' };
  const session = (weight: number, reps: (number | null)[]): SessionExercise => ({
    id: 'press', name: 'DB Bench', equipment: 'other', weight, sets: reps.map(r => ({ target: 8, min: 6, reps: r })),
  });

  it('builds sets with the top of the range as the tap target', () => {
    const w = createWorkout('A', { ...programState, exercises: { ...defs, press }, program: { A: ['press'], B: ['squat'] } });
    expect(w.exercises[0].sets).toEqual([{ target: 8, min: 6, reps: null }, { target: 8, min: 6, reps: null }, { target: 8, min: 6, reps: null }]);
  });

  it('classifies sessions against the range', () => {
    expect(exerciseOutcome(session(20, [8, 8, 8]))).toBe('success');
    expect(exerciseOutcome(session(20, [8, 7, 6]))).toBe('progress');
    expect(exerciseOutcome(session(20, [8, 7, 5]))).toBe('failed');
    expect(exerciseOutcome(session(20, [8, 8, null]))).toBe('failed');
  });

  it('adds weight only when every set reaches the top', () => {
    expect(progressLift({ weight: 20, failures: 1, bestReps: 22 }, session(20, [8, 8, 8]), press, kg)).toEqual({ weight: 22, failures: 0 });
  });

  it('keeps the weight and records reps while they keep climbing', () => {
    expect(progressLift({ weight: 20, failures: 0 }, session(20, [7, 6, 6]), press, kg)).toEqual({ weight: 20, failures: 0, bestReps: 19 });
    expect(progressLift({ weight: 20, failures: 1, bestReps: 19 }, session(20, [7, 7, 6]), press, kg)).toEqual({ weight: 20, failures: 0, bestReps: 20 });
  });

  it('counts a session with no rep gain as a stall, and deloads after the limit', () => {
    expect(progressLift({ weight: 20, failures: 0, bestReps: 20 }, session(20, [7, 7, 6]), press, kg)).toEqual({ weight: 20, failures: 1, bestReps: 20 });
    expect(progressLift({ weight: 20, failures: 1, bestReps: 20 }, session(20, [8, 6, 5]), press, kg)).toEqual({ weight: 20, failures: 2, bestReps: 20 });
    // Third stall: 20 × 0.9 = 18.
    expect(progressLift({ weight: 20, failures: 2, bestReps: 20 }, session(20, [6, 6, 6]), press, kg)).toEqual({ weight: 18, failures: 0 });
  });

  it('starts rep tracking fresh after a weight change', () => {
    expect(progressLift({ weight: 22, failures: 0 }, session(22, [6, 6, 6]), press, kg)).toEqual({ weight: 22, failures: 0, bestReps: 18 });
    expect(progressLift({ weight: 20, failures: 2, bestReps: 23 }, session(22, [6, 6, 6]), press, kg)).toEqual({ weight: 22, failures: 0, bestReps: 18 });
  });

  it('steps timed sets down 5 seconds per tap', () => {
    expect(nextReps({ target: 30, reps: null }, TIMED_STEP)).toBe(30);
    expect(nextReps({ target: 30, reps: 30 }, TIMED_STEP)).toBe(25);
    expect(nextReps({ target: 30, reps: 3 }, TIMED_STEP)).toBe(0);
    expect(nextReps({ target: 30, reps: 0 }, TIMED_STEP)).toBe(null);
  });

  it('formats targets', () => {
    expect(formatScheme(press)).toBe('3×6–8');
    expect(formatScheme({ ...press, timed: true, minReps: 20, reps: 30 })).toBe('3×20–30s');
    expect(formatScheme({ ...press, perSide: true, minReps: 8 })).toBe('3×8/side');
    expect(formatScheme(defs.squat)).toBe('5×5');
  });
});

describe('break deload', () => {
  it('suggests 10% per two weeks off, max 30%', () => {
    expect(breakDeloadPercent(null)).toBe(0);
    expect(breakDeloadPercent(13)).toBe(0);
    expect(breakDeloadPercent(14)).toBe(10);
    expect(breakDeloadPercent(30)).toBe(20);
    expect(breakDeloadPercent(200)).toBe(30);
  });

  it('measures days since the newest finished workout', () => {
    const day = 86_400_000;
    const w = { ...createWorkout('A', programState), finishedAt: 0 };
    expect(daysSinceLastWorkout([w], 15 * day)).toBe(15);
    expect(daysSinceLastWorkout([], 15 * day)).toBeNull();
  });
});

describe('weights', () => {
  it('rounds to loadable weights', () => {
    expect(roundLoadable(56.2, kg)).toBe(55);
    expect(roundLoadable(56.5, kg)).toBe(57.5);
    expect(roundLoadable(10, kg)).toBe(20);
  });

  it('computes plates per side', () => {
    expect(plateBreakdown(100, 20, kg.plates)).toEqual({ perSide: [25, 15], remainder: 0 });
    expect(plateBreakdown(62.5, 20, kg.plates)).toEqual({ perSide: [20, 1.25], remainder: 0 });
    expect(plateBreakdown(20, 20, kg.plates).perSide).toEqual([]);
    expect(plateBreakdown(21, 20, kg.plates)).toEqual({ perSide: [], remainder: 0.5 });
  });

  it('builds a warmup that ramps from the empty bar', () => {
    expect(warmupSets(100, kg)).toEqual([
      { weight: 20, reps: 5 },
      { weight: 20, reps: 5 },
      { weight: 40, reps: 5 },
      { weight: 60, reps: 3 },
      { weight: 80, reps: 2 },
    ]);
    expect(warmupSets(20, kg)).toEqual([]);
    const light = warmupSets(30, kg);
    expect(light.every(s => s.weight < 30)).toBe(true);
  });

  it('converts between kg and lb', () => {
    expect(convertWeight(100, 'kg', 'lb')).toBeCloseTo(220.46, 1);
    expect(convertWeight(220.462, 'lb', 'kg')).toBeCloseTo(100, 2);
  });
});
