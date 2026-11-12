import { describe, it, expect } from 'vitest';
import { summarizeWorkout } from './summary';
import type { SessionExercise, Workout } from '../types';

function ex(id: string, weight: number, reps: (number | null)[], extra: Partial<SessionExercise> = {}): SessionExercise {
  return { id, name: id, equipment: 'barbell', weight, sets: reps.map(r => ({ target: 5, reps: r })), ...extra };
}

function workout(exercises: SessionExercise[], unit: 'kg' | 'lb' = 'kg', at = 1): Workout {
  return {
    id: `w${at}`, type: 'A', unit, startedAt: at * 1000, finishedAt: at * 1000 + 600_000,
    exercises, note: '', bodyWeight: null, rest: null, breakDeloadHandled: true,
  };
}

describe('summarizeWorkout', () => {
  it('flags heavier weight as a weight PR and more reps at the best weight as a rep PR', () => {
    const earlier = [
      workout([ex('squat', 60, [5, 5, 5]), ex('bench', 40, [5, 5, 4])], 'kg', 2),
      workout([ex('squat', 55, [5, 5, 5]), ex('bench', 40, [5, 4, 4])], 'kg', 1),
    ];
    const s = summarizeWorkout(
      workout([ex('squat', 62.5, [5, 5, 5]), ex('bench', 40, [5, 5, 5])], 'kg', 3),
      earlier,
      { squat: { weight: 65, failures: 0 }, bench: { weight: 42.5, failures: 0 } },
    );
    expect(s.exercises.map(e => [e.record, e.previousBest, e.nextWeight])).toEqual([
      ['weight', 60, 65],
      ['reps', 40, 42.5],
    ]);
    expect(s.records).toBe(2);
    expect(s.durationSec).toBe(600);
    expect(s.setsLogged).toBe(6);
    expect(s.volume).toBe(1538);
  });

  it('sets no record on a first session, a lighter day, or a skipped lift', () => {
    const earlier = [workout([ex('squat', 60, [5, 5, 5])])];
    const s = summarizeWorkout(
      workout([ex('squat', 50, [5, 5, 5]), ex('row', 40, [5, 5, 5]), ex('ohp', 30, [null, null])], 'kg', 2),
      [...earlier, workout([ex('ohp', 20, [5])])],
      {},
    );
    expect(s.exercises.map(e => e.record)).toEqual([null, null, null]);
    expect(s.setsLogged).toBe(6);
    expect(s.setsTotal).toBe(8);
  });

  it('ignores sessions where the lift was skipped and compares across units', () => {
    const earlier = [workout([ex('squat', 100, [null, null])]), workout([ex('squat', 135, [5])], 'lb')];
    const s = summarizeWorkout(workout([ex('squat', 62.5, [5])], 'kg', 3), earlier, {});
    expect(s.exercises[0].record).toBe('weight');
    expect(s.exercises[0].previousBest).toBeCloseTo(61.2, 1);
  });

  it('counts timed holds toward rep PRs but not volume', () => {
    const hold = (secs: number[]) => ex('plank', 0, secs, { equipment: 'other', timed: true });
    const s = summarizeWorkout(workout([hold([45, 45])], 'kg', 2), [workout([hold([40, 45])])], {});
    expect(s.exercises[0].record).toBe('reps');
    expect(s.volume).toBe(0);
  });
});
