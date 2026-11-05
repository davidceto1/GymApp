import type { AppState, ExerciseDef, ExerciseId, LiftState, Settings, Unit, Workout, WorkoutType } from '../types';
import {
  BUILT_IN_IDS,
  DEFAULT_PROGRAM,
  defaultExercises,
  defaultLifts,
  defaultSettings,
  startWeight,
  unitDefaults,
} from '../logic/program';
import { convertWeight } from '../logic/weights';
import {
  createWorkout,
  finishWorkout,
  hasLoggedSets,
  isSetFailed,
  nextReps,
  roundForExercise,
} from '../logic/workout';

export type Preset = '5x5' | '3x5';

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
  /** Create or update an exercise; `weight` sets its next working weight. */
  | { type: 'saveExercise'; exercise: ExerciseDef; weight?: number }
  | { type: 'deleteExercise'; id: ExerciseId }
  | { type: 'setProgram'; workout: WorkoutType; ids: ExerciseId[] }
  | { type: 'applyPreset'; preset: Preset }
  | { type: 'import'; state: AppState }
  | { type: 'resetAll' };

export function initialState(unit: Unit = 'kg'): AppState {
  const base = {
    version: 2 as const,
    settings: defaultSettings(unit),
    exercises: defaultExercises(unit),
    program: { A: [...DEFAULT_PROGRAM.A], B: [...DEFAULT_PROGRAM.B] },
    lifts: defaultLifts(unit),
    nextType: 'A' as const,
    history: [],
  };
  return { ...base, current: createWorkout('A', base) };
}

function updateCurrent(state: AppState, fn: (w: Workout) => Workout): AppState {
  return { ...state, current: fn(state.current) };
}

/** Rebuild the not-yet-started workout so it reflects new lifts/settings/program. */
function refreshIfUntouched(state: AppState): AppState {
  if (hasLoggedSets(state.current)) return state;
  const fresh = createWorkout(state.current.type, state);
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

function mapLifts(state: AppState, fn: (lift: LiftState, def: ExerciseDef | undefined) => LiftState) {
  return Object.fromEntries(
    Object.entries(state.lifts).map(([id, lift]) => [id, fn(lift, state.exercises[id])]),
  ) as Record<ExerciseId, LiftState>;
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
      const lifts = mapLifts(state, (lift, def) => ({
        weight: roundForExercise(
          lift.weight * (1 - action.percent / 100),
          def?.equipment ?? 'barbell',
          def?.increment ?? 0,
          state.settings,
        ),
        failures: 0,
      }));
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
          ...createWorkout(type, state),
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
          ...createWorkout(state.current.type, state),
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
      // 2.5 kg ↔ 5 lb is how StrongLifts maps increments between units.
      const factor = to === 'lb' ? 2 : 0.5;
      const exercises = Object.fromEntries(
        Object.entries(state.exercises).map(([id, def]) => [id, { ...def, increment: def.increment * factor }]),
      );
      const round = (value: number, def: ExerciseDef | undefined) =>
        roundForExercise(convertWeight(value, from, to), def?.equipment ?? 'barbell', def?.increment ?? 0, settings);
      const lifts = mapLifts({ ...state, exercises }, (lift, def) => ({ ...lift, weight: round(lift.weight, def) }));
      const current: Workout = {
        ...state.current,
        unit: to,
        exercises: state.current.exercises.map(e => ({ ...e, weight: round(e.weight, exercises[e.id]) })),
        bodyWeight:
          state.current.bodyWeight == null
            ? null
            : Math.round(convertWeight(state.current.bodyWeight, from, to) * 10) / 10,
      };
      return { ...state, settings, exercises, lifts, current };
    }

    case 'setLift': {
      const lifts = { ...state.lifts, [action.id]: { ...(state.lifts[action.id] ?? { weight: 0, failures: 0 }), ...action.lift } };
      return refreshIfUntouched({ ...state, lifts });
    }

    case 'saveExercise': {
      const def = {
        ...action.exercise,
        name: action.exercise.name.trim() || 'Exercise',
        sets: Math.max(1, Math.round(action.exercise.sets)),
        reps: Math.max(1, Math.round(action.exercise.reps)),
        increment: Math.max(0, action.exercise.increment),
      };
      const exercises = { ...state.exercises, [def.id]: def };
      const existing = state.lifts[def.id];
      const lift: LiftState =
        action.weight != null
          ? { weight: Math.max(0, action.weight), failures: existing && existing.weight === action.weight ? existing.failures : 0 }
          : existing ?? { weight: startWeight(def.equipment, state.settings), failures: 0 };
      return refreshIfUntouched({ ...state, exercises, lifts: { ...state.lifts, [def.id]: lift } });
    }

    case 'deleteExercise': {
      if (state.program.A.includes(action.id) || state.program.B.includes(action.id)) return state;
      const exercises = { ...state.exercises };
      const lifts = { ...state.lifts };
      delete exercises[action.id];
      delete lifts[action.id];
      return { ...state, exercises, lifts };
    }

    case 'setProgram': {
      const ids = action.ids.filter((id, i) => state.exercises[id] && action.ids.indexOf(id) === i);
      if (ids.length === 0) return state;
      return refreshIfUntouched({ ...state, program: { ...state.program, [action.workout]: ids } });
    }

    case 'applyPreset': {
      const defaults = defaultExercises(state.settings.unit);
      const exercises = { ...state.exercises };
      const lifts = { ...state.lifts };
      const startLifts = defaultLifts(state.settings.unit);
      for (const id of BUILT_IN_IDS) {
        exercises[id] = {
          ...defaults[id],
          sets: id === 'deadlift' ? 1 : action.preset === '5x5' ? 5 : 3,
        };
        lifts[id] ??= startLifts[id];
      }
      return refreshIfUntouched({
        ...state,
        exercises,
        lifts,
        program: { A: [...DEFAULT_PROGRAM.A], B: [...DEFAULT_PROGRAM.B] },
      });
    }

    case 'import':
      return action.state;

    case 'resetAll':
      return initialState(state.settings.unit);
  }
}
