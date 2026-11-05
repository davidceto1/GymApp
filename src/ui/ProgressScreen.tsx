import { useState } from 'react';
import type { AppState, ExerciseId } from '../types';
import { EXERCISE_IDS, EXERCISE_NAMES } from '../logic/program';
import { convertWeight, formatWeight } from '../logic/weights';
import { exerciseOutcome } from '../logic/workout';
import { LineChart, type ChartPoint } from './LineChart';

type View = ExerciseId | 'bodyweight';

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function liftPoints(state: AppState, id: ExerciseId): ChartPoint[] {
  const unit = state.settings.unit;
  const points: ChartPoint[] = [];
  for (const w of [...state.history].reverse()) {
    const ex = w.exercises.find(e => e.id === id);
    if (!ex) continue;
    const outcome = exerciseOutcome(ex);
    if (outcome === 'skipped') continue;
    points.push({
      t: w.finishedAt ?? w.startedAt ?? 0,
      value: round1(convertWeight(ex.weight, w.unit, unit)),
      failed: outcome === 'failed',
      detail: `${ex.sets.length}×${ex.sets[0]?.target ?? 5}: ${ex.sets.map(s => s.reps ?? '–').join(' ')}`,
    });
  }
  return points;
}

export function ProgressScreen({ state }: { state: AppState }) {
  const [view, setView] = useState<View>('squat');
  const unit = state.settings.unit;

  const points: ChartPoint[] =
    view === 'bodyweight'
      ? [...state.history]
          .reverse()
          .filter(w => w.bodyWeight != null)
          .map(w => ({ t: w.finishedAt ?? 0, value: round1(convertWeight(w.bodyWeight!, w.unit, unit)) }))
      : liftPoints(state, view);

  const completed = points.filter(p => !p.failed);
  const best = completed.length ? Math.max(...completed.map(p => p.value)) : null;

  return (
    <div className="screen">
      <header className="screen-header"><h1>Progress</h1></header>

      <div className="chips" role="tablist" aria-label="Choose a lift">
        {[...EXERCISE_IDS, 'bodyweight' as const].map(id => (
          <button key={id} role="tab" aria-selected={view === id} className="chip" onClick={() => setView(id)}>
            {id === 'bodyweight' ? 'Body weight' : EXERCISE_NAMES[id]}
          </button>
        ))}
      </div>

      {view !== 'bodyweight' ? (
        <div className="stats">
          <div className="stat"><span className="stat-value">{formatWeight(state.lifts[view].weight)}</span><span className="stat-label">Next ({unit})</span></div>
          <div className="stat"><span className="stat-value">{best == null ? '–' : formatWeight(best)}</span><span className="stat-label">Best 5-rep ({unit})</span></div>
          <div className="stat"><span className="stat-value">{best == null ? '–' : formatWeight(round1(best * (1 + 5 / 30)))}</span><span className="stat-label">Est. 1RM ({unit})</span></div>
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
        <h2 className="card-title">{view === 'bodyweight' ? 'Body weight' : EXERCISE_NAMES[view]}</h2>
        <LineChart points={points} unit={unit} label={view === 'bodyweight' ? 'Body weight' : EXERCISE_NAMES[view]} />
      </section>
    </div>
  );
}
