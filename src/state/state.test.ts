import { describe, it, expect, beforeEach } from 'vitest';
import { initialState, reducer, type Action } from './reducer';
import { STORAGE_KEY, historyToCsv, loadState, parseState, saveState } from './storage';
import type { AppState, ExerciseDef } from '../types';

function run(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state);
}

/** Exercise ids of workout `id` in the program. */
function ids(state: AppState, id: string): string[] | undefined {
  return state.program.find(w => w.id === id)?.exercises;
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

  it('picks a different workout only before any set is logged', () => {
    let s = run(initialState(), { type: 'selectWorkout', id: 'B' });
    expect(s.current.type).toBe('B');
    expect(s.current.name).toBe('Workout B');
    expect(s.nextType).toBe('B');
    expect(run(s, { type: 'selectWorkout', id: 'Z' })).toBe(s);
    s = run(s, { type: 'tapSet', exercise: 0, set: 0, now: 1 }, { type: 'selectWorkout', id: 'A' });
    expect(s.current.type).toBe('B');
  });

  it('converts weights when changing units', () => {
    let s = run(initialState(), { type: 'setLift', id: 'squat', lift: { weight: 100 } });
    s = run(s, { type: 'setUnit', unit: 'lb' });
    expect(s.settings.barWeight).toBe(45);
    expect(s.exercises.squat.increment).toBe(5);
    expect(s.exercises.deadlift.increment).toBe(10);
    expect(s.lifts.squat.weight).toBe(220);
    expect(s.current.unit).toBe('lb');
  });

  it('rebuilds an untouched workout when applying the 3×5 preset', () => {
    const s = run(initialState(), { type: 'applyPreset', preset: '3x5' });
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

describe('workout editor', () => {
  const pullups: ExerciseDef = { id: 'pullups', name: 'Pull-ups', sets: 3, reps: 8, minReps: 8, timed: false, perSide: false, increment: 2.5, equipment: 'other' };

  it('creates an exercise and adds it to a workout', () => {
    let s = run(initialState(), { type: 'saveExercise', exercise: pullups, weight: 0 });
    expect(s.lifts.pullups).toEqual({ weight: 0, failures: 0 });
    s = run(s, { type: 'setProgram', workout: 'A', ids: [...ids(s, 'A')!, 'pullups'] });
    expect(ids(s, 'A')).toEqual(['squat', 'bench', 'row', 'pullups']);
    // The untouched current workout picks up the change right away.
    expect(s.current.exercises.map(e => e.name)).toEqual(['Squat', 'Bench Press', 'Barbell Row', 'Pull-ups']);
    expect(s.current.exercises[3].sets).toHaveLength(3);
  });

  it('reorders and removes exercises, dropping duplicates and unknown ids', () => {
    let s = run(initialState(), { type: 'setProgram', workout: 'B', ids: ['deadlift', 'squat'] });
    expect(ids(s, 'B')).toEqual(['deadlift', 'squat']);
    s = run(s, { type: 'setProgram', workout: 'B', ids: ['squat', 'squat', 'nope'] });
    expect(ids(s, 'B')).toEqual(['squat']);
    expect(ids(run(s, { type: 'setProgram', workout: 'B', ids: [] }), 'B')).toEqual([]);
  });

  it('edits sets, reps and increment of an existing exercise', () => {
    let s = run(initialState(), {
      type: 'saveExercise',
      exercise: { ...initialState().exercises.bench, sets: 4, reps: 6, minReps: 6, increment: 1.25 },
      weight: 40,
    });
    expect(s.current.exercises[1]).toMatchObject({ weight: 40 });
    expect(s.current.exercises[1].sets).toEqual(Array(4).fill({ target: 6, reps: null }));
    s = reducer(logAll(s), { type: 'finishWorkout', now: 1 });
    expect(s.lifts.bench.weight).toBe(41.25);
  });

  it('does not change a workout that is already in progress', () => {
    let s = run(initialState(), { type: 'tapSet', exercise: 0, set: 0, now: 1 });
    s = run(s, { type: 'setProgram', workout: 'A', ids: ['deadlift'] });
    expect(s.current.exercises.map(e => e.id)).toEqual(['squat', 'bench', 'row']);
    s = reducer(s, { type: 'finishWorkout', now: 2 });
    s = run(s, { type: 'selectWorkout', id: 'A' });
    expect(s.current.exercises.map(e => e.id)).toEqual(['deadlift']);
  });

  it('only deletes exercises that are not in a workout', () => {
    let s = run(initialState(), { type: 'saveExercise', exercise: pullups });
    s = run(s, { type: 'setProgram', workout: 'A', ids: ['pullups'] });
    expect(run(s, { type: 'deleteExercise', id: 'pullups' }).exercises.pullups).toBeDefined();
    s = run(s, { type: 'setProgram', workout: 'A', ids: ['squat'] }, { type: 'deleteExercise', id: 'pullups' });
    expect(s.exercises.pullups).toBeUndefined();
    expect(s.lifts.pullups).toBeUndefined();
  });

  it('keeps history readable after an exercise is renamed', () => {
    let s = reducer(logAll(initialState()), { type: 'finishWorkout', now: 1 });
    s = run(s, { type: 'saveExercise', exercise: { ...s.exercises.squat, name: 'Low-bar Squat' } });
    expect(s.history[0].exercises[0].name).toBe('Squat');
    expect(s.current.exercises[0].name).toBe('Low-bar Squat');
  });

  it('restores the StrongLifts program with a preset, keeping weights', () => {
    let s = run(initialState(), { type: 'setLift', id: 'squat', lift: { weight: 100 } });
    s = run(s, { type: 'setProgram', workout: 'A', ids: ['deadlift'] }, { type: 'applyPreset', preset: '5x5' });
    expect(s.program).toEqual([
      { id: 'A', name: 'Workout A', exercises: ['squat', 'bench', 'row'] },
      { id: 'B', name: 'Workout B', exercises: ['squat', 'ohp', 'deadlift'] },
    ]);
    expect(s.lifts.squat.weight).toBe(100);
  });
});

describe('configurable workouts', () => {
  const finishAll = (s: AppState, now: number) => reducer(logAll(s), { type: 'finishWorkout', now });

  it('runs a single workout every session', () => {
    let s = run(initialState(), { type: 'removeWorkout', id: 'B' });
    expect(s.program.map(w => w.id)).toEqual(['A']);
    expect(run(s, { type: 'removeWorkout', id: 'A' })).toBe(s);
    s = finishAll(s, 1);
    expect(s.current.type).toBe('A');
    expect(s.nextType).toBe('A');
  });

  it('adds up to five workouts and rotates through them in order', () => {
    let s = run(initialState(), { type: 'addWorkout' }, { type: 'addWorkout' }, { type: 'addWorkout' });
    expect(s.program.map(w => w.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(s.program[2]).toEqual({ id: 'C', name: 'Workout C', exercises: [] });
    expect(run(s, { type: 'addWorkout' })).toBe(s);
    for (const id of ['C', 'D', 'E']) s = run(s, { type: 'setProgram', workout: id, ids: ['squat'] });

    const order: string[] = [];
    for (let i = 0; i < 6; i++) {
      order.push(s.current.type);
      s = finishAll(s, i + 1);
    }
    expect(order).toEqual(['A', 'B', 'C', 'D', 'E', 'A']);
    expect(s.history.map(w => w.name)).toEqual(['Workout A', 'Workout E', 'Workout D', 'Workout C', 'Workout B', 'Workout A']);
  });

  it('reuses a freed id after a workout is removed', () => {
    const s = run(initialState(), { type: 'addWorkout' }, { type: 'removeWorkout', id: 'B' }, { type: 'addWorkout' });
    expect(s.program.map(w => w.id)).toEqual(['A', 'C', 'B']);
  });

  it('renames a workout, updating the untouched session but not history', () => {
    let s = finishAll(initialState(), 1);
    s = run(s, { type: 'renameWorkout', id: 'A', name: 'Lower' }, { type: 'renameWorkout', id: 'B', name: 'Upper' });
    expect(s.current.name).toBe('Upper');
    expect(s.history[0].name).toBe('Workout A');
    s = finishAll(s, 2);
    expect(s.current.name).toBe('Lower');
  });

  it('reorders the rotation', () => {
    let s = run(initialState(), { type: 'addWorkout' }, { type: 'setProgram', workout: 'C', ids: ['row'] });
    s = run(s, { type: 'moveWorkout', id: 'C', dir: -1 });
    expect(s.program.map(w => w.id)).toEqual(['A', 'C', 'B']);
    expect(run(s, { type: 'moveWorkout', id: 'A', dir: -1 })).toBe(s);
    s = finishAll(s, 1);
    expect(s.current.type).toBe('C');
  });

  it('moves on to the next workout when the planned one is removed', () => {
    let s = run(initialState(), { type: 'addWorkout' }, { type: 'setProgram', workout: 'C', ids: ['row'] });
    s = finishAll(s, 1);
    expect(s.current.type).toBe('B');
    s = run(s, { type: 'removeWorkout', id: 'B' });
    expect(s.current.type).toBe('C');
    expect(s.nextType).toBe('C');
    expect(s.current.exercises.map(e => e.id)).toEqual(['row']);
  });

  it('keeps an in-progress session when its workout is removed, then restarts the rotation', () => {
    let s = run(initialState(), { type: 'addWorkout' }, { type: 'tapSet', exercise: 0, set: 0, now: 1 });
    s = run(s, { type: 'removeWorkout', id: 'A' });
    expect(s.current.type).toBe('A');
    s = reducer(s, { type: 'finishWorkout', now: 2 });
    expect(s.current.type).toBe('B');
  });

  it('presets replace every workout and keep a valid next workout', () => {
    let s = run(
      initialState(),
      { type: 'addWorkout' },
      { type: 'setProgram', workout: 'C', ids: ['row'] },
      { type: 'selectWorkout', id: 'C' },
    );
    s = run(s, { type: 'applyPreset', preset: '5x5' });
    expect(s.program.map(w => w.id)).toEqual(['A', 'B']);
    expect(s.nextType).toBe('A');
    expect(s.current.type).toBe('A');
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

  it('reads the old { A, B } program and validates workout lists', () => {
    const old = JSON.parse(JSON.stringify(initialState()));
    old.program = { A: ['squat'], B: ['deadlift'] };
    expect(parseState(old).program).toEqual([
      { id: 'A', name: 'Workout A', exercises: ['squat'] },
      { id: 'B', name: 'Workout B', exercises: ['deadlift'] },
    ]);
    const bad = (program: unknown) => () => parseState({ ...initialState(), program });
    expect(bad([])).toThrow();
    expect(bad(['A', 'B', 'C', 'D', 'E', 'F'].map(id => ({ id, name: id, exercises: [] })))).toThrow();
    expect(bad([{ id: 'A', name: 'A', exercises: [] }, { id: 'A', name: 'A2', exercises: [] }])).toThrow();
    expect(bad([{ id: 'A', name: 'A', exercises: ['nope'] }])).toThrow();
    const one = parseState({ ...initialState(), program: [{ id: 'C', name: 'Full body', exercises: ['squat'] }], nextType: 'A' });
    expect(one.nextType).toBe('C');
  });

  it('rejects malformed imports', () => {
    expect(() => parseState({ foo: 1 })).toThrow();
    expect(() => parseState({ ...initialState(), history: [{}] })).toThrow();
    expect(parseState(JSON.parse(JSON.stringify(initialState()))).version).toBe(2);
  });


  it('migrates version 1 saves (fixed lifts, settings-based increments)', () => {
    const set = (reps: number | null) => ({ target: 5, reps });
    const v1 = {
      version: 1,
      settings: {
        unit: 'kg', barWeight: 20, plates: [20, 10, 5, 2.5, 1.25], restEasy: 90, restHard: 180, restFailed: 300,
        increments: { squat: 2.5, bench: 1.25, row: 2.5, ohp: 1.25, deadlift: 5 },
        deloadPercent: 10, failuresBeforeDeload: 3, program: '3x5', sound: false,
      },
      lifts: { squat: { weight: 80, failures: 0 }, bench: { weight: 50, failures: 1 }, row: { weight: 60, failures: 0 }, ohp: { weight: 35, failures: 0 }, deadlift: { weight: 100, failures: 0 } },
      nextType: 'B',
      history: [{
        id: 'h1', type: 'A', unit: 'kg', startedAt: 0, finishedAt: 1, note: '', bodyWeight: null, rest: null, breakDeloadHandled: true,
        exercises: [{ id: 'squat', weight: 77.5, sets: [set(5), set(5), set(5)] }],
      }],
      current: {
        id: 'c', type: 'B', unit: 'kg', startedAt: null, finishedAt: null, note: '', bodyWeight: null, rest: null, breakDeloadHandled: false,
        exercises: [{ id: 'squat', weight: 80, sets: [set(null), set(null), set(null)] }],
      },
    };
    const s = parseState(v1);
    expect(s.version).toBe(2);
    expect(s.program.map(w => [w.id, w.name, w.exercises])).toEqual([
      ['A', 'Workout A', ['squat', 'bench', 'row']],
      ['B', 'Workout B', ['squat', 'ohp', 'deadlift']],
    ]);
    expect(s.nextType).toBe('B');
    expect(s.current.name).toBe('Workout B');
    expect(s.history[0].name).toBeUndefined();
    expect(s.exercises.bench).toMatchObject({ name: 'Bench Press', sets: 3, reps: 5, increment: 1.25, equipment: 'barbell' });
    expect(s.exercises.deadlift.sets).toBe(1);
    expect(s.lifts.bench).toEqual({ weight: 50, failures: 1 });
    expect(s.settings).not.toHaveProperty('increments');
    expect(s.settings.sound).toBe(false);
    expect(s.history[0].exercises[0]).toMatchObject({ name: 'Squat', equipment: 'barbell', weight: 77.5 });
    expect(s.current.exercises[0].name).toBe('Squat');
  });
  it('exports history as CSV', () => {
    let s = run(initialState(), { type: 'setNote', note: 'heavy, "tough"' });
    s = reducer(logAll(s), { type: 'finishWorkout', now: Date.UTC(2026, 0, 2) });
    const csv = historyToCsv(s.history);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('Date,Workout,Exercise,Weight,Unit,Reps,Body Weight,Note');
    expect(lines[1]).toBe('2026-01-02,Workout A,Squat,20,kg,5/5/5/5/5,,"heavy, ""tough"""');
    expect(lines).toHaveLength(4);
  });
});
