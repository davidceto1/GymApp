import type { AppState } from '../types';
import { formatWeight } from '../logic/weights';
import { formatTarget, workoutDefName, workoutLabel } from '../logic/program';
import { setMin } from '../logic/workout';
import { summarizeWorkout, type ExerciseSummary } from '../logic/summary';
import { formatClock, formatDate, formatLoad } from './format';

interface WorkoutSummaryProps {
  state: AppState;
  workoutId: string;
  onDone: () => void;
}

function NextWeight({ item, unit }: { item: ExerciseSummary; unit: string }) {
  const { exercise: ex, nextWeight, outcome } = item;
  if (nextWeight == null || outcome === 'skipped') return null;
  if (nextWeight > ex.weight) {
    return <span className="summary-next up">Next: {formatWeight(nextWeight)}{unit} ↑</span>;
  }
  if (nextWeight < ex.weight) {
    return <span className="summary-next down">Next: {formatWeight(nextWeight)}{unit} (deload)</span>;
  }
  if (ex.weight === 0 && ex.equipment === 'other') return null;
  return <span className="summary-next">Next: same weight</span>;
}

export function WorkoutSummary({ state, workoutId, onDone }: WorkoutSummaryProps) {
  const index = state.history.findIndex(w => w.id === workoutId);
  if (index < 0) return null;
  const workout = state.history[index];
  const summary = summarizeWorkout(workout, state.history.slice(index + 1), state.lifts);
  const { unit } = workout;

  return (
    <div className="screen summary-screen">
      <header className="screen-header">
        <div>
          <h1>{workoutLabel(workout)} done</h1>
          <p className="muted">{formatDate(workout.finishedAt ?? 0)}</p>
        </div>
      </header>

      <section className="card summary-stats" aria-label="Workout stats">
        <div>
          <strong>{summary.durationSec != null ? formatClock(summary.durationSec) : '–'}</strong>
          <span className="muted small">Duration</span>
        </div>
        <div>
          <strong>{summary.setsLogged}/{summary.setsTotal}</strong>
          <span className="muted small">Sets</span>
        </div>
        <div>
          <strong>{summary.volume.toLocaleString()}{unit}</strong>
          <span className="muted small">Volume</span>
        </div>
      </section>

      {summary.records > 0 && (
        <div className="banner success summary-records" role="status">
          🏆 {summary.records === 1 ? 'New record!' : `${summary.records} new records!`}
        </div>
      )}

      <section className="card" aria-label="Exercises">
        {summary.exercises.map(item => {
          const { exercise: ex, outcome, record, previousBest } = item;
          const first = ex.sets[0];
          return (
            <div key={ex.id} className={`summary-exercise ${outcome}`}>
              <div className="summary-exercise-head">
                <strong>{ex.name}</strong>
                {record === 'weight' && (
                  <span className="tag record">
                    Weight PR{previousBest != null && previousBest > 0 && ` (was ${formatWeight(Math.round(previousBest * 100) / 100)}${unit})`}
                  </span>
                )}
                {record === 'reps' && <span className="tag record">Rep PR</span>}
                {outcome === 'failed' && <span className="tag failed">missed reps</span>}
                {outcome === 'skipped' && <span className="tag">skipped</span>}
              </div>
              <div className="muted small">
                {ex.sets.length}×{first ? formatTarget(first.target, setMin(first), ex) : ''} {formatLoad(ex.weight, unit, ex.equipment)}
                {' · '}
                {ex.sets.map(s => s.reps ?? '–').join(' / ')}
              </div>
              <NextWeight item={item} unit={unit} />
            </div>
          );
        })}
      </section>

      {workout.note && <p className="card note">“{workout.note}”</p>}

      <button className="btn primary wide summary-done" onClick={onDone}>
        Start {workoutDefName(state.program, state.current.type)}
      </button>
    </div>
  );
}
