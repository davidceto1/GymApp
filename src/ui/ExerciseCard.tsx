import { useState } from 'react';
import type { SessionExercise, Settings } from '../types';
import { EXERCISE_NAMES } from '../logic/program';
import { formatWeight, warmupSets } from '../logic/weights';

interface ExerciseCardProps {
  exercise: SessionExercise;
  settings: Settings;
  onTapSet: (setIndex: number) => void;
  onOpenWeight: () => void;
}

export function ExerciseCard({ exercise, settings, onTapSet, onOpenWeight }: ExerciseCardProps) {
  const [tab, setTab] = useState<'work' | 'warmup'>('work');
  const [warmupDone, setWarmupDone] = useState<boolean[]>([]);
  const name = EXERCISE_NAMES[exercise.id];
  const warmups = warmupSets(exercise.weight, settings);
  const target = exercise.sets[0]?.target ?? 5;
  const u = settings.unit;

  return (
    <section className="exercise-card" aria-label={name}>
      <header className="exercise-header">
        <h2 className="exercise-name">{name}</h2>
        <button className="exercise-weight" onClick={onOpenWeight} aria-label={`${name} weight and plates`}>
          {exercise.sets.length}×{target} {formatWeight(exercise.weight)}{u} <span aria-hidden="true">›</span>
        </button>
      </header>

      <div className="tabs small" role="tablist">
        <button role="tab" aria-selected={tab === 'work'} onClick={() => setTab('work')}>Work sets</button>
        <button role="tab" aria-selected={tab === 'warmup'} onClick={() => setTab('warmup')}>
          Warmup{warmups.length ? ` (${warmups.length})` : ''}
        </button>
      </div>

      {tab === 'work' ? (
        <div className="sets-row">
          {exercise.sets.map((set, i) => {
            const state = set.reps === null ? 'empty' : set.reps >= set.target ? 'done' : 'failed';
            return (
              <button
                key={i}
                className={`set-circle ${state}`}
                aria-label={`Set ${i + 1}: ${set.reps === null ? 'not logged' : `${set.reps} reps`}`}
                onClick={() => onTapSet(i)}
              >
                {set.reps ?? set.target}
              </button>
            );
          })}
        </div>
      ) : warmups.length === 0 ? (
        <p className="muted small">No warmup needed at the empty bar — just do your work sets.</p>
      ) : (
        <ul className="warmup-list">
          {warmups.map((w, i) => (
            <li key={i}>
              <button
                className={`set-circle small ${warmupDone[i] ? 'done' : 'empty'}`}
                aria-label={`Warmup ${i + 1}: ${w.reps} reps at ${formatWeight(w.weight)}${u}${warmupDone[i] ? ', done' : ''}`}
                onClick={() => setWarmupDone(d => {
                  const next = [...d];
                  next[i] = !next[i];
                  return next;
                })}
              >
                {w.reps}
              </button>
              <span>{w.reps}×{formatWeight(w.weight)}{u}</span>
              <span className="muted small">{w.weight === settings.barWeight ? 'Empty bar' : `${Math.round((w.weight / exercise.weight) * 100)}%`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
