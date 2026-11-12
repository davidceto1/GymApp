import { useState, type Dispatch } from 'react';
import type { AppState } from '../types';
import type { Action } from '../state/reducer';
import { formatWeight } from '../logic/weights';
import { workoutDefName, workoutLabel } from '../logic/program';
import {
  breakDeloadPercent,
  daysSinceLastWorkout,
  hasLoggedSets,
  isWorkoutComplete,
} from '../logic/workout';
import { ExerciseCard } from './ExerciseCard';
import { WeightSheet } from './WeightSheet';
import { NumberField } from './common';
import { formatClock, formatDate } from './format';
import { useNow } from './useNow';

interface WorkoutScreenProps {
  state: AppState;
  dispatch: Dispatch<Action>;
  /** Called with the id of the workout that was just saved to history. */
  onFinished?: (id: string) => void;
}

export function WorkoutScreen({ state, dispatch, onFinished }: WorkoutScreenProps) {
  const { current: workout, settings } = state;
  const [weightSheet, setWeightSheet] = useState<number | null>(null);
  const now = useNow(workout.startedAt != null);
  const started = hasLoggedSets(workout);
  const complete = isWorkoutComplete(workout);

  const days = daysSinceLastWorkout(state.history, now);
  const deload = workout.breakDeloadHandled || started ? 0 : breakDeloadPercent(days);

  const finish = () => {
    if (!complete && !window.confirm('Some sets are not logged. Unlogged exercises are skipped and partly logged ones count as failed. Finish anyway?')) {
      return;
    }
    dispatch({ type: 'finishWorkout', now: Date.now() });
    onFinished?.(workout.id);
  };

  const editing = weightSheet != null ? workout.exercises[weightSheet] : null;

  return (
    <div className="screen workout-screen">
      <header className="screen-header">
        <div>
          <h1>{workoutLabel(workout)}</h1>
          <p className="muted">
            {formatDate(workout.startedAt ?? now)}
            {workout.startedAt != null && <> · <span aria-label="Workout duration">{formatClock((now - workout.startedAt) / 1000)}</span></>}
          </p>
        </div>
        {!started && state.program.length > 1 && (
          <select
            className="input workout-picker"
            aria-label="Choose workout"
            value={workout.type}
            onChange={e => dispatch({ type: 'selectWorkout', id: e.target.value })}
          >
            {state.program.map(w => (
              <option key={w.id} value={w.id}>{workoutDefName(state.program, w.id)}</option>
            ))}
          </select>
        )}
      </header>

      {workout.exercises.length === 0 && (
        <p className="card muted">This workout has no exercises yet. Add some in Settings → Workouts.</p>
      )}

      {deload > 0 && (
        <div className="banner" role="alert">
          <p>
            Welcome back! It's been {days} days since your last workout. Deload {deload}% to ease back in?
          </p>
          <div className="banner-actions">
            <button className="btn" onClick={() => dispatch({ type: 'skipBreakDeload' })}>Skip</button>
            <button className="btn primary" onClick={() => dispatch({ type: 'acceptBreakDeload', percent: deload })}>
              Deload {deload}%
            </button>
          </div>
        </div>
      )}

      {workout.exercises.map((ex, i) => (
        <ExerciseCard
          key={`${workout.id}-${ex.id}`}
          exercise={ex}
          settings={settings}
          onTapSet={set => dispatch({ type: 'tapSet', exercise: i, set, now: Date.now() })}
          onOpenWeight={() => setWeightSheet(i)}
        />
      ))}

      <section className="card notes">
        <label className="field">
          <span>Body weight ({settings.unit})</span>
          <NumberField
            label="Body weight"
            value={workout.bodyWeight}
            step={0.1}
            allowEmpty
            onCommit={v => dispatch({ type: 'setBodyWeight', bodyWeight: v })}
          />
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea
            className="input"
            rows={2}
            placeholder="How did it feel?"
            value={workout.note}
            onChange={e => dispatch({ type: 'setNote', note: e.target.value })}
          />
        </label>
      </section>

      <div className="finish-row">
        {started && (
          <button
            className="btn"
            onClick={() => window.confirm('Clear all logged sets for this workout?') && dispatch({ type: 'resetCurrent' })}
          >
            Reset
          </button>
        )}
        <button className="btn primary wide" disabled={!started} onClick={finish}>
          {complete ? 'Finish workout' : 'Finish early'}
        </button>
      </div>

      <section className="next-weights muted small" aria-label="Working weights">
        {workout.exercises.map(ex => {
          const lift = state.lifts[ex.id];
          return (
            <span key={ex.id}>
              {ex.name}: {formatWeight(ex.weight)}{settings.unit}
              {lift && lift.failures > 0 && ` · failed ${lift.failures}×`}
            </span>
          );
        })}
      </section>

      {editing && (
        <WeightSheet
          exercise={editing}
          settings={settings}
          onClose={() => setWeightSheet(null)}
          onSave={weight => {
            dispatch({ type: 'setExerciseWeight', exercise: weightSheet!, weight });
            setWeightSheet(null);
          }}
        />
      )}
    </div>
  );
}
