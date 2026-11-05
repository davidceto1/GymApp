import { describe, it, expect, beforeEach } from 'vitest';
import { initialState, reducer, type Action } from './reducer';
import { STORAGE_KEY, historyToCsv, loadState, parseState, saveState } from './storage';
import type { AppState } from '../types';

function run(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state);
}

function logAll(state: AppState, reps = 5): AppState {
  let s = state;
  s.current.exercises.forEach((ex, i) =>
    ex.sets.forEach((_, j) => {
      s = reducer(s, { type: 'tapSet', exercise: i, set: j, now: 1000 });
      for (let k = 5; k > reps; k--) s = reducer(s, { type: 'tapSet', exercise: i, set: j, now: 1000 });
    }),
  );
  return s;
}

describe('reducer', () => {
  it('alternates A and B and progresses weights on finish', () => {
    let s = logAll(initialState());
    s = reducer(s, { type: 'finishWorkout', now: 5000 });
    expect(s.history).toHaveLength(1);
    expect(s.history[0].finishedAt).toBe(5000);
    expect(s.current.type).toBe('B');
    expect(s.lifts.squat.weight).toBe(22.5);
    expect(s.lifts.bench.weight).toBe(22.5);
    expect(s.lifts.row.weight).toBe(32.5);
    expect(s.current.exercises[0].weight).toBe(22.5);

    s = reducer(logAll(s), { type: 'finishWorkout', now: 6000 });
    expect(s.current.type).toBe('A');
    expect(s.lifts.squat.weight).toBe(25);
    expect(s.lifts.deadlift.weight).toBe(45);
  });

  it('does not finish an empty workout', () => {
    const s = initialState();
    expect(reducer(s, { type: 'finishWorkout', now: 1 })).toBe(s);
  });

  it('starts the rest timer when a set is logged, flagged failed on missed reps', () => {
    let s = run(initialState(), { type: 'tapSet', exercise: 0, set: 0, now: 100 });
    expect(s.current.rest).toEqual({ startedAt: 100, failed: false });
    expect(s.current.startedAt).toBe(100);
    s = run(s, { type: 'tapSet', exercise: 0, set: 0, now: 200 });
    expect(s.current.rest).toEqual({ startedAt: 200, failed: true });
    s = run(s, { type: 'dismissRest' });
    expect(s.current.rest).toBeNull();
  });

  it('deloads after three failed sessions', () => {
    let s = initialState();
    s = run(s, { type: 'setLift', id: 'squat', lift: { weight: 100 } });
    for (let i = 0; i < 3; i++) {
      // Make sure the next workout always has squat in first position.
      s = reducer(logAll(s, 4), { type: 'finishWorkout', now: i });
    }
    expect(s.lifts.squat).toEqual({ weight: 90, failures: 0 });
  });

  it('applies a break deload to all lifts', () => {
    let s = run(initialState(), { type: 'setLift', id: 'squat', lift: { weight: 100 } });
    s = run(s, { type: 'acceptBreakDeload', percent: 20 });
    expect(s.lifts.squat.weight).toBe(80);
    expect(s.current.exercises[0].weight).toBe(80);
    expect(s.current.breakDeloadHandled).toBe(true);
  });

  it('switches workout type only before any set is logged', () => {
    let s = run(initialState(), { type: 'switchWorkoutType' });
    expect(s.current.type).toBe('B');
    s = run(s, { type: 'tapSet', exercise: 0, set: 0, now: 1 }, { type: 'switchWorkoutType' });
    expect(s.current.type).toBe('B');
  });

  it('converts weights when changing units', () => {
    let s = run(initialState(), { type: 'setLift', id: 'squat', lift: { weight: 100 } });
    s = run(s, { type: 'setUnit', unit: 'lb' });
    expect(s.settings.barWeight).toBe(45);
    expect(s.settings.increments.squat).toBe(5);
    expect(s.lifts.squat.weight).toBe(220);
    expect(s.current.unit).toBe('lb');
  });

  it('rebuilds an untouched workout when switching to 3×5', () => {
    const s = run(initialState(), { type: 'updateSettings', settings: { program: '3x5' } });
    expect(s.current.exercises[0].sets).toHaveLength(3);
  });

  it('edits today\'s weight without touching saved lifts until finish', () => {
    let s = run(initialState(), { type: 'setExerciseWeight', exercise: 0, weight: 50 });
    expect(s.current.exercises[0].weight).toBe(50);
    expect(s.lifts.squat.weight).toBe(20);
    s = reducer(logAll(s), { type: 'finishWorkout', now: 1 });
    expect(s.lifts.squat.weight).toBe(52.5);
  });

  it('deletes workouts from history', () => {
    let s = reducer(logAll(initialState()), { type: 'finishWorkout', now: 1 });
    s = run(s, { type: 'deleteWorkout', id: s.history[0].id });
    expect(s.history).toHaveLength(0);
  });
});

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips through localStorage', () => {
    const s = run(initialState(), { type: 'setNote', note: 'felt good' });
    saveState(s);
    expect(loadState().current.note).toBe('felt good');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('felt good');
  });

  it('falls back to a fresh state on corrupt storage', () => {
    localStorage.setItem(STORAGE_KEY, '{nope');
    expect(loadState().history).toEqual([]);
  });

  it('rejects malformed imports', () => {
    expect(() => parseState({ foo: 1 })).toThrow();
    expect(() => parseState({ ...initialState(), history: [{}] })).toThrow();
    expect(parseState(JSON.parse(JSON.stringify(initialState()))).version).toBe(1);
  });

  it('exports history as CSV', () => {
    let s = run(initialState(), { type: 'setNote', note: 'heavy, "tough"' });
    s = reducer(logAll(s), { type: 'finishWorkout', now: Date.UTC(2026, 0, 2) });
    const csv = historyToCsv(s.history);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('Date,Workout,Exercise,Weight,Unit,Reps,Body Weight,Note');
    expect(lines[1]).toBe('2026-01-02,A,Squat,20,kg,5/5/5/5/5,,"heavy, ""tough"""');
    expect(lines).toHaveLength(4);
  });
});
