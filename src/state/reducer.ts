import type { AppState, ExerciseId, LiftState, Settings, Unit, Workout, WorkoutType } from '../types';
import { EXERCISE_IDS, defaultLifts, defaultSettings, unitDefaults } from '../logic/program';
import { convertWeight, roundLoadable } from '../logic/weights';
import {
  createWorkout,
  finishWorkout,
  hasLoggedSets,
  isSetFailed,
  nextReps,
} from '../logic/workout';

export type Action =
  | { type: 'tapSet'; exercise: number; set: number; now: number }
  | { type: 'setExerciseWeight'; exercise: number; weight: number }
  | { type: 'setNote'; note: string }
  | { type: 'setBodyWeight'; bodyWeight: number | null }
  | { type: 'acceptBreakDeload'; percent: number }
  | { type: 'skipBreakDeload' }
  | { type: 'switchWorkoutType' }
  | { type: 'resetCurrent' }
  | { type: 'finishWorkout'; now: number }
  | { type: 'dismissRest' }
  | { type: 'deleteWorkout'; id: string }
  | { type: 'updateSettings'; settings: Partial<Omit<Settings, 'unit'>> }
  | { type: 'setUnit'; unit: Unit }
  | { type: 'setLift'; id: ExerciseId; lift: Partial<LiftState> }
  | { type: 'import'; state: AppState }
  | { type: 'resetAll' };

export function initialState(unit: Unit = 'kg'): AppState {
  const settings = defaultSettings(unit);
  const lifts = defaultLifts(unit);
  return {
    version: 1,
    settings,
    lifts,
    nextType: 'A',
    history: [],
    current: createWorkout('A', lifts, settings),
  };
}

function updateCurrent(state: AppState, fn: (w: Workout) => Workout): AppState {
  return { ...state, current: fn(state.current) };
}

/** Rebuild the not-yet-started workout so it reflects new lifts/settings. */
function refreshIfUntouched(state: AppState): AppState {
  if (hasLoggedSets(state.current)) return state;
  const fresh = createWorkout(state.current.type, state.lifts, state.settings);
  return {
    ...state,
    current: {
      ...fresh,
      id: state.current.id,
      note: state.current.note,
      bodyWeight: state.current.bodyWeight,
      breakDeloadHandled: state.current.breakDeloadHandled,
    },
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'tapSet':
      return updateCurrent(state, w => {
        const ex = w.exercises[action.exercise];
        const set = ex?.sets[action.set];
        if (!set) return w;
        const reps = nextReps(set);
        const updated = { ...set, reps };
        const exercises = w.exercises.map((e, i) =>
          i === action.exercise
            ? { ...e, sets: e.sets.map((s, j) => (j === action.set ? updated : s)) }
            : e,
        );
        // A freshly logged (or decremented) set restarts the rest timer;
        // clearing a set leaves the timer alone.
        const rest =
          reps === null ? w.rest : { startedAt: action.now, failed: isSetFailed(updated) };
        return {
          ...w,
          exercises,
          rest,
          startedAt: w.startedAt ?? (reps !== null ? action.now : null),
          breakDeloadHandled: true,
        };
      });

    case 'setExerciseWeight':
      return updateCurrent(state, w => ({
        ...w,
        exercises: w.exercises.map((e, i) =>
          i === action.exercise ? { ...e, weight: Math.max(0, action.weight) } : e,
        ),
      }));

    case 'setNote':
      return updateCurrent(state, w => ({ ...w, note: action.note }));

    case 'setBodyWeight':
      return updateCurrent(state, w => ({ ...w, bodyWeight: action.bodyWeight }));

    case 'acceptBreakDeload': {
      const lifts = Object.fromEntries(
        EXERCISE_IDS.map(id => [
          id,
          {
            weight: roundLoadable(state.lifts[id].weight * (1 - action.percent / 100), state.settings),
            failures: 0,
          },
        ]),
      ) as Record<ExerciseId, LiftState>;
      const next = refreshIfUntouched({ ...state, lifts });
      return updateCurrent(next, w => ({ ...w, breakDeloadHandled: true }));
    }

    case 'skipBreakDeload':
      return updateCurrent(state, w => ({ ...w, breakDeloadHandled: true }));

    case 'switchWorkoutType': {
      if (hasLoggedSets(state.current)) return state;
      const type: WorkoutType = state.current.type === 'A' ? 'B' : 'A';
      return {
        ...state,
        nextType: type,
        current: {
          ...createWorkout(type, state.lifts, state.settings),
          note: state.current.note,
          bodyWeight: state.current.bodyWeight,
          breakDeloadHandled: state.current.breakDeloadHandled,
        },
      };
    }

    case 'resetCurrent':
      return {
        ...state,
        current: {
          ...createWorkout(state.current.type, state.lifts, state.settings),
          breakDeloadHandled: state.current.breakDeloadHandled,
        },
      };

    case 'finishWorkout':
      return finishWorkout(state, action.now);

    case 'dismissRest':
      return updateCurrent(state, w => ({ ...w, rest: null }));

    case 'deleteWorkout':
      return { ...state, history: state.history.filter(w => w.id !== action.id) };

    case 'updateSettings':
      return refreshIfUntouched({ ...state, settings: { ...state.settings, ...action.settings } });

    case 'setUnit': {
      const from = state.settings.unit;
      const to = action.unit;
      if (from === to) return state;
      const settings: Settings = { ...state.settings, unit: to, ...unitDefaults(to) };
      const lifts = Object.fromEntries(
        EXERCISE_IDS.map(id => [
          id,
          {
            ...state.lifts[id],
            weight: roundLoadable(convertWeight(state.lifts[id].weight, from, to), settings),
          },
        ]),
      ) as Record<ExerciseId, LiftState>;
      const convert = (w: Workout): Workout => ({
        ...w,
        unit: to,
        exercises: w.exercises.map(e => ({
          ...e,
          weight: roundLoadable(convertWeight(e.weight, from, to), settings),
        })),
        bodyWeight:
          w.bodyWeight == null ? null : Math.round(convertWeight(w.bodyWeight, from, to) * 10) / 10,
      });
      return { ...state, settings, lifts, current: convert(state.current) };
    }

    case 'setLift': {
      const lifts = { ...state.lifts, [action.id]: { ...state.lifts[action.id], ...action.lift } };
      return refreshIfUntouched({ ...state, lifts });
    }

    case 'import':
      return action.state;

    case 'resetAll':
      return initialState(state.settings.unit);
  }
}
