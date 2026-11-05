import { useState, type Dispatch } from 'react';
import type { AppState, Workout } from '../types';
import type { Action } from '../state/reducer';
import { EXERCISE_NAMES } from '../logic/program';
import { formatWeight } from '../logic/weights';
import { exerciseOutcome } from '../logic/workout';
import { formatClock, formatDate } from './format';

function monthKey(ms: number): string {
  return formatDate(ms, { month: 'long', year: 'numeric' });
}

function WorkoutCard({ workout, onDelete }: { workout: Workout; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const end = workout.finishedAt ?? 0;
  const duration = workout.startedAt != null ? (end - workout.startedAt) / 1000 : null;

  return (
    <article className="card history-card">
      <button className="history-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="history-date">
          <strong>{formatDate(end, { day: 'numeric' })}</strong>
          <span>{formatDate(end, { weekday: 'short' })}</span>
        </span>
        <span className="history-body">
          <span className="history-title">
            Workout {workout.type}
            {duration != null && duration > 0 && <span className="muted small"> · {formatClock(duration)}</span>}
          </span>
          {workout.exercises.map(ex => {
            const outcome = exerciseOutcome(ex);
            return (
              <span key={ex.id} className={`history-line ${outcome}`}>
                {EXERCISE_NAMES[ex.id]} {ex.sets.length}×{ex.sets[0]?.target} {formatWeight(ex.weight)}{workout.unit}
                {outcome === 'failed' && <span className="tag failed">missed reps</span>}
                {outcome === 'skipped' && <span className="tag">skipped</span>}
              </span>
            );
          })}
        </span>
      </button>
      {open && (
        <div className="history-detail">
          {workout.exercises.map(ex => (
            <p key={ex.id}>
              <span className="muted">{EXERCISE_NAMES[ex.id]}:</span> {ex.sets.map(s => s.reps ?? '–').join(' / ')}
            </p>
          ))}
          {workout.bodyWeight != null && <p><span className="muted">Body weight:</span> {formatWeight(workout.bodyWeight)} {workout.unit}</p>}
          {workout.note && <p className="note">“{workout.note}”</p>}
          <button className="btn danger small" onClick={onDelete}>Delete workout</button>
        </div>
      )}
    </article>
  );
}

export function HistoryScreen({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const { history } = state;
  if (history.length === 0) {
    return (
      <div className="screen">
        <header className="screen-header"><h1>History</h1></header>
        <p className="muted empty-state">No workouts yet. Finish your first workout and it will show up here.</p>
      </div>
    );
  }

  const groups: [string, Workout[]][] = [];
  for (const w of history) {
    const key = monthKey(w.finishedAt ?? 0);
    const last = groups[groups.length - 1];
    if (last && last[0] === key) last[1].push(w);
    else groups.push([key, [w]]);
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>History</h1>
        <p className="muted">{history.length} workout{history.length === 1 ? '' : 's'}</p>
      </header>
      {groups.map(([month, workouts]) => (
        <section key={month} aria-label={month}>
          <h2 className="section-label">{month} · {workouts.length}</h2>
          {workouts.map(w => (
            <WorkoutCard
              key={w.id}
              workout={w}
              onDelete={() => window.confirm('Delete this workout from history?') && dispatch({ type: 'deleteWorkout', id: w.id })}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
