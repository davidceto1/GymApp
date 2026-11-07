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
