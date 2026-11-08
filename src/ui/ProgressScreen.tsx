import { useState } from 'react';
import type { AppState, ExerciseId } from '../types';
import { convertWeight, formatWeight } from '../logic/weights';
import { formatTarget } from '../logic/program';
import { exerciseOutcome, setMin } from '../logic/workout';
import { LineChart, type ChartPoint } from './LineChart';

const BODYWEIGHT = 'bodyweight';

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Exercises in the current program first, then anything else that appears in history. */
function chartableExercises(state: AppState): { id: ExerciseId; name: string }[] {
  const names = new Map<ExerciseId, string>();
  for (const id of [...state.program.A, ...state.program.B]) {
    if (state.exercises[id]) names.set(id, state.exercises[id].name);
  }
  for (const w of state.history) {
    for (const ex of w.exercises) {
      if (!names.has(ex.id)) names.set(ex.id, state.exercises[ex.id]?.name ?? ex.name);
    }
  }
  return [...names].map(([id, name]) => ({ id, name }));
}

function liftPoints(state: AppState, id: ExerciseId): (ChartPoint & { reps: number })[] {
  const unit = state.settings.unit;
  const points: (ChartPoint & { reps: number })[] = [];
  for (const w of [...state.history].reverse()) {
    const ex = w.exercises.find(e => e.id === id);
    if (!ex) continue;
    const outcome = exerciseOutcome(ex);
    if (outcome === 'skipped') continue;
    const first = ex.sets[0];
    // Fewest reps in a logged set drives the 1RM estimate; holds don't estimate a 1RM (0).
    const logged = ex.sets.flatMap(s => (s.reps == null ? [] : [s.reps]));
    const reps = ex.timed ? 0 : Math.min(...logged);
    points.push({
      t: w.finishedAt ?? w.startedAt ?? 0,
      value: round1(convertWeight(ex.weight, w.unit, unit)),
      failed: outcome === 'failed',
      reps,
      detail: `${ex.sets.length}×${first ? formatTarget(first.target, setMin(first), ex) : ''}: ${ex.sets.map(s => s.reps ?? '–').join(' ')}`,
    });
  }
  return points;
}

export function ProgressScreen({ state }: { state: AppState }) {
  const options = chartableExercises(state);
  const [selected, setView] = useState<ExerciseId>(options[0]?.id ?? BODYWEIGHT);
  const view = selected === BODYWEIGHT || options.some(o => o.id === selected) ? selected : options[0]?.id ?? BODYWEIGHT;
  const unit = state.settings.unit;
  const viewName = view === BODYWEIGHT ? 'Body weight' : options.find(o => o.id === view)?.name ?? '';

  const lift = view === BODYWEIGHT ? [] : liftPoints(state, view);
  const points: ChartPoint[] =
    view === BODYWEIGHT
      ? [...state.history]
          .reverse()
          .filter(w => w.bodyWeight != null)
          .map(w => ({ t: w.finishedAt ?? 0, value: round1(convertWeight(w.bodyWeight!, w.unit, unit)) }))
      : lift;

  const completed = lift.filter(p => !p.failed);
  const best = completed.length ? Math.max(...completed.map(p => p.value)) : null;
  // Epley estimate from the best completed session.
  const repSessions = completed.filter(p => p.reps > 0);
  const oneRm = repSessions.length ? Math.max(...repSessions.map(p => p.value * (1 + p.reps / 30))) : null;
  const next = view === BODYWEIGHT ? undefined : state.lifts[view]?.weight;

  return (
    <div className="screen">
      <header className="screen-header"><h1>Progress</h1></header>

      <div className="chips" role="tablist" aria-label="Choose a lift">
        {[...options, { id: BODYWEIGHT, name: 'Body weight' }].map(o => (
          <button key={o.id} role="tab" aria-selected={view === o.id} className="chip" onClick={() => setView(o.id)}>
            {o.name}
          </button>
        ))}
      </div>

      {view !== BODYWEIGHT ? (
        <div className="stats">
          <div className="stat"><span className="stat-value">{next == null ? '–' : formatWeight(next)}</span><span className="stat-label">Next ({unit})</span></div>
          <div className="stat"><span className="stat-value">{best == null ? '–' : formatWeight(best)}</span><span className="stat-label">Best ({unit})</span></div>
          <div className="stat"><span className="stat-value">{oneRm == null ? '–' : formatWeight(round1(oneRm))}</span><span className="stat-label">Est. 1RM ({unit})</span></div>
          <div className="stat"><span className="stat-value">{points.length}</span><span className="stat-label">Sessions</span></div>
        </div>
      ) : (
        <div className="stats">
          <div className="stat"><span className="stat-value">{points.length ? formatWeight(points[points.length - 1].value) : '–'}</span><span className="stat-label">Latest ({unit})</span></div>
          <div className="stat">
            <span className="stat-value">
              {points.length > 1 ? `${points[points.length - 1].value - points[0].value >= 0 ? '+' : ''}${formatWeight(round1(points[points.length - 1].value - points[0].value))}` : '–'}
            </span>
            <span className="stat-label">Change ({unit})</span>
          </div>
        </div>
      )}

      <section className="card">
        <h2 className="card-title">{viewName}</h2>
        <LineChart points={points} unit={unit} label={viewName} />
      </section>
    </div>
  );
}
