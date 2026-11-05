import { useState, type Dispatch } from 'react';
import type { AppState } from '../types';
import type { Action } from '../state/reducer';
import { EXERCISE_NAMES } from '../logic/program';
import { formatWeight } from '../logic/weights';
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
}

export function WorkoutScreen({ state, dispatch }: WorkoutScreenProps) {
  const { current: workout, settings } = state;
  const [weightSheet, setWeightSheet] = useState<number | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const now = useNow(workout.startedAt != null);
  const started = hasLoggedSets(workout);
  const complete = isWorkoutComplete(workout);

  const days = daysSinceLastWorkout(state.history, now);
  const deload = workout.breakDeloadHandled || started ? 0 : breakDeloadPercent(days);

  const finish = () => {
    if (!complete && !window.confirm('Some sets are not logged. Unlogged exercises are skipped and partly logged ones count as failed. Finish anyway?')) {
      return;
    }
    const finishedAt = Date.now();
    const next = workout.type === 'A' ? 'B' : 'A';
    dispatch({ type: 'finishWorkout', now: finishedAt });
    setSummary(`Workout ${workout.type} saved. Next up: Workout ${next}.`);
  };

  const editing = weightSheet != null ? workout.exercises[weightSheet] : null;

  return (
    <div className="screen workout-screen">
      <header className="screen-header">
        <div>
          <h1>Workout {workout.type}</h1>
          <p className="muted">
            {formatDate(workout.startedAt ?? now)}
            {workout.startedAt != null && <> · <span aria-label="Workout duration">{formatClock((now - workout.startedAt) / 1000)}</span></>}
          </p>
        </div>
        {!started && (
          <button className="btn small" onClick={() => dispatch({ type: 'switchWorkoutType' })}>
            Switch to {workout.type === 'A' ? 'B' : 'A'}
          </button>
        )}
      </header>

      {summary && (
        <div className="banner success" role="status">
          <span>{summary}</span>
          <button className="icon-btn" aria-label="Dismiss" onClick={() => setSummary(null)}>✕</button>
        </div>
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
              {EXERCISE_NAMES[ex.id]}: {formatWeight(ex.weight)}{settings.unit}
              {lift.failures > 0 && ` · failed ${lift.failures}×`}
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
