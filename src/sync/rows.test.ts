import { describe, it, expect } from 'vitest';
import { initialState, reducer } from '../state/reducer';
import type { AppState } from '../types';
import { diffRows, isEmptyDiff, mergeHistory, rowsToState, stateToRows } from './rows';

function withWorkouts(n: number, base: AppState = initialState()): AppState {
  let s = base;
  for (let i = 0; i < n; i++) {
    s.current.exercises.forEach((ex, e) => ex.sets.forEach((_, set) => {
      s = reducer(s, { type: 'tapSet', exercise: e, set, now: 1_700_000_000_000 + i * 86_400_000 });
    }));
    s = reducer(s, { type: 'finishWorkout', now: 1_700_000_000_000 + i * 86_400_000 + 3_600_000 });
  }
  return s;
}

function roundTrip(state: AppState): AppState {
  const rows = stateToRows(state);
  return rowsToState(rows.userState, Object.values(rows.exercises), Object.values(rows.workouts));
}

describe('cloud rows', () => {
  it('round-trips app state through database rows', () => {
    const state = withWorkouts(3);
    const back = roundTrip(state);
    expect(back.settings).toEqual(state.settings);
    expect(back.exercises).toEqual(state.exercises);
    expect(back.lifts).toEqual(state.lifts);
    expect(back.nextType).toBe(state.nextType);
    expect(back.history.map(w => w.id)).toEqual(state.history.map(w => w.id));
    expect(back.history[0].exercises).toEqual(state.history[0].exercises);
    expect(back.history[0].finishedAt).toBe(state.history[0].finishedAt);
    // Re-encoding gives identical rows, so a fresh pull never looks like a local change.
    expect(isEmptyDiff(diffRows(stateToRows(state), stateToRows(back)))).toBe(true);
  });

  it('round-trips configurable workouts and workout names', () => {
    let state = reducer(initialState(), { type: 'addWorkout' });
    state = reducer(state, { type: 'setProgram', workout: 'C', ids: ['row'] });
    state = reducer(state, { type: 'renameWorkout', id: 'C', name: 'Pull day' });
    state = withWorkouts(3, state);
    expect(state.current.type).toBe('A');
    const rows = stateToRows(state);
    expect(rows.workouts[state.history[0].id]).toMatchObject({ type: 'C', name: 'Pull day' });
    const back = roundTrip(state);
    expect(back.program).toEqual(state.program);
    expect(back.history.map(w => w.name)).toEqual(['Pull day', 'Workout B', 'Workout A']);
    expect(isEmptyDiff(diffRows(rows, stateToRows(back)))).toBe(true);

    // Rows written before workouts had names, with the old { A, B } program.
    const old = { ...rows.userState, program: { A: ['squat'], B: ['deadlift'] } as unknown as AppState['program'] };
    const legacy = rowsToState(old, Object.values(rows.exercises), Object.values(rows.workouts).map(w => ({ ...w, name: null })));
    expect(legacy.program.map(w => w.id)).toEqual(['A', 'B']);
    expect(legacy.history[0].name).toBeUndefined();
  });

  it('round-trips rep ranges, timed and per-side exercises', () => {
    const plank = { id: 'plank', name: 'Plank', sets: 3, reps: 45, minReps: 30, timed: true, perSide: false, increment: 0, equipment: 'other' as const };
    const stepUp = { id: 'stepup', name: 'Step-up', sets: 3, reps: 10, minReps: 8, timed: false, perSide: true, increment: 2, equipment: 'other' as const };
    let state = reducer(initialState(), { type: 'saveExercise', exercise: plank, weight: 0 });
    state = reducer(state, { type: 'saveExercise', exercise: stepUp, weight: 0 });
    const rows = stateToRows(state);
    expect(rows.exercises.plank).toMatchObject({ min_reps: 30, timed: true, per_side: false });
    expect(roundTrip(state).exercises).toEqual(state.exercises);
  });

  it('reads exercise rows written before rep ranges as fixed targets', () => {
    const rows = stateToRows(initialState());
    const old = Object.values(rows.exercises).map(r => ({ ...r, min_reps: null }));
    const back = rowsToState(rows.userState, old, []);
    expect(back.exercises.squat).toMatchObject({ reps: 5, minReps: 5, timed: false, perSide: false });
  });

  it('uploads everything when the cloud is empty', () => {
    const state = withWorkouts(2);
    const d = diffRows(null, stateToRows(state));
    expect(d.userState).not.toBeNull();
    expect(d.upsertExercises).toHaveLength(Object.keys(state.exercises).length);
    expect(d.upsertWorkouts).toHaveLength(2);
  });

  it('sends only what changed since the last sync', () => {
    const before = withWorkouts(2);
    const after = withWorkouts(1, reducer(before, { type: 'deleteWorkout', id: before.history[1].id }));
    const d = diffRows(stateToRows(before), stateToRows(after));
    expect(d.deleteWorkouts).toEqual([before.history[1].id]);
    expect(d.upsertWorkouts.map(w => w.id)).toEqual([after.history[0].id]);
    expect(d.upsertExercises).toEqual([]);
    expect(d.userState).not.toBeNull();
  });

  it('detects nothing to do when state is unchanged', () => {
    const s = withWorkouts(1);
    expect(isEmptyDiff(diffRows(stateToRows(s), stateToRows(s)))).toBe(true);
  });

  it('keeps local-only workouts when merging with the cloud copy', () => {
    const remote = withWorkouts(2);
    const local = withWorkouts(1, { ...initialState(), history: [remote.history[0]] });
    const merged = mergeHistory(remote, local);
    expect(merged.history).toHaveLength(3);
    expect(merged.settings).toBe(remote.settings);
  });
});
