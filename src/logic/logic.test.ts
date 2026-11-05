import { describe, it, expect } from 'vitest';
import { defaultLifts, defaultSettings, setCountFor } from './program';
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
} from './workout';
import type { SessionExercise } from '../types';

const kg = defaultSettings('kg');

function ex(id: SessionExercise['id'], weight: number, reps: (number | null)[]): SessionExercise {
  return { id, weight, sets: reps.map(r => ({ target: 5, reps: r })) };
}

describe('program', () => {
  it('builds workout A as squat/bench/row 5×5', () => {
    const w = createWorkout('A', defaultLifts('kg'), kg);
    expect(w.exercises.map(e => e.id)).toEqual(['squat', 'bench', 'row']);
    expect(w.exercises.every(e => e.sets.length === 5 && e.sets.every(s => s.target === 5))).toBe(true);
  });

  it('builds workout B with deadlift 1×5', () => {
    const w = createWorkout('B', defaultLifts('kg'), kg);
    expect(w.exercises.map(e => e.id)).toEqual(['squat', 'ohp', 'deadlift']);
    expect(w.exercises[2].sets).toHaveLength(1);
  });

  it('uses StrongLifts starting weights', () => {
    expect(defaultLifts('kg')).toMatchObject({
      squat: { weight: 20 }, bench: { weight: 20 }, row: { weight: 30 }, ohp: { weight: 20 }, deadlift: { weight: 40 },
    });
    expect(defaultLifts('lb').squat.weight).toBe(45);
  });

  it('supports the 3×5 variant', () => {
    expect(setCountFor('squat', '3x5')).toBe(3);
    expect(setCountFor('deadlift', '3x5')).toBe(1);
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
    expect(progressLift(lift, ex('squat', 60, [5, 5, 5, 5, 5]), kg)).toEqual({ weight: 62.5, failures: 0 });
    expect(progressLift({ weight: 100, failures: 0 }, ex('deadlift', 100, [5]), kg).weight).toBe(105);
  });

  it('repeats the weight after a failed session', () => {
    expect(progressLift({ weight: 60, failures: 0 }, ex('bench', 60, [5, 5, 5, 4, 3]), kg)).toEqual({ weight: 60, failures: 1 });
  });

  it('deloads 10% after the third consecutive failure, rounded to plates', () => {
    expect(progressLift({ weight: 62.5, failures: 2 }, ex('bench', 62.5, [5, 5, 4, 4, 4]), kg)).toEqual({ weight: 57.5, failures: 0 });
  });

  it('resets the failure count when the weight was changed manually', () => {
    expect(progressLift({ weight: 60, failures: 2 }, ex('bench', 55, [5, 4, 4, 4, 4]), kg)).toEqual({ weight: 55, failures: 1 });
  });

  it('treats unlogged exercises as skipped and partially logged as failed', () => {
    expect(exerciseOutcome(ex('row', 40, [null, null, null, null, null]))).toBe('skipped');
    expect(exerciseOutcome(ex('row', 40, [5, 5, null, null, null]))).toBe('failed');
    const lift = { weight: 40, failures: 1 };
    expect(progressLift(lift, ex('row', 40, [null, null, null, null, null]), kg)).toBe(lift);
  });

  it('never deloads below the empty bar', () => {
    expect(progressLift({ weight: 20, failures: 2 }, ex('ohp', 20, [3, 3, 3, 3, 3]), kg).weight).toBe(20);
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
    const w = { ...createWorkout('A', defaultLifts(), kg), finishedAt: 0 };
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
