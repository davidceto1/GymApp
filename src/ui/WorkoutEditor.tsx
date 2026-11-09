import { useState, type Dispatch } from 'react';
import type { AppState, Equipment, ExerciseDef, ExerciseId, WorkoutType } from '../types';
import type { Action } from '../state/reducer';
import { defaultIncrement, formatScheme, isBuiltIn, startWeight } from '../logic/program';
import { formatWeight } from '../logic/weights';
import { newId } from '../logic/workout';
import { NumberField, Sheet } from './common';
import { formatLoad } from './format';

interface Draft {
  def: ExerciseDef;
  weight: number;
  /** Workout to add the exercise to once it's saved (new exercises only). */
  addTo: WorkoutType | null;
}

function ExerciseSheet({
  draft,
  unit,
  isNew,
  onSave,
  onClose,
}: {
  draft: Draft;
  unit: string;
  isNew: boolean;
  onSave: (d: Draft) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState(draft);
  const set = (patch: Partial<ExerciseDef>) => setD(prev => ({ ...prev, def: { ...prev.def, ...patch } }));
  const noun = d.def.timed ? 'seconds' : 'reps';

  return (
    <Sheet title={isNew ? 'New exercise' : `Edit ${draft.def.name}`} onClose={onClose}>
      <div className="form-grid">
        <label className="field span-2">
          <span>Name</span>
          <input
            className="input"
            aria-label="Exercise name"
            value={d.def.name}
            placeholder="e.g. Pull-ups"
            autoFocus={isNew}
            onChange={e => set({ name: e.target.value })}
          />
        </label>
        <div className="field span-2">
          <span>Equipment</span>
          <div className="segmented" role="radiogroup" aria-label="Equipment">
            {(['barbell', 'other'] as Equipment[]).map(eq => (
              <button key={eq} role="radio" aria-checked={d.def.equipment === eq} onClick={() => set({ equipment: eq })}>
                {eq === 'barbell' ? 'Barbell' : 'Dumbbell / other'}
              </button>
            ))}
          </div>
        </div>
        <label className="setting-row span-2">
          <span>Timed hold (seconds instead of reps)</span>
          <input type="checkbox" className="switch" checked={d.def.timed} onChange={e => set({ timed: e.target.checked })} />
        </label>
        <label className="setting-row span-2">
          <span>Per side (single arm / leg)</span>
          <input type="checkbox" className="switch" checked={d.def.perSide} onChange={e => set({ perSide: e.target.checked })} />
        </label>
        <label className="field">
          <span>Sets</span>
          <NumberField label="Sets" value={d.def.sets} min={1} onCommit={v => v != null && set({ sets: v })} />
        </label>
        <span className="field" aria-hidden="true" />
        <label className="field">
          <span>Min {noun}</span>
          <NumberField
            label={`Min ${noun}`}
            value={d.def.minReps}
            min={1}
            onCommit={v => v != null && set({ minReps: v, reps: Math.max(v, d.def.reps) })}
          />
        </label>
        <label className="field">
          <span>Max {noun}</span>
          <NumberField
            label={`Max ${noun}`}
            value={d.def.reps}
            min={1}
            onCommit={v => v != null && set({ reps: v, minReps: Math.min(v, d.def.minReps) })}
          />
        </label>
        <label className="field">
          <span>Next weight ({unit})</span>
          <NumberField label="Next weight" value={d.weight} step={0.5} onCommit={v => v != null && setD(prev => ({ ...prev, weight: v }))} />
        </label>
        <label className="field">
          <span>+ at top of range ({unit})</span>
          <NumberField label="Increment" value={d.def.increment} step={0.25} onCommit={v => v != null && set({ increment: v })} />
        </label>
      </div>
      <p className="muted small">
        {d.def.minReps < d.def.reps
          ? `Double progression: keep the weight and add ${noun} until every set reaches ${d.def.reps}, then add weight. `
          : `Fixed target: add weight once every set reaches ${d.def.reps}. `}
        {d.def.equipment === 'barbell'
          ? 'Barbell lifts get warmup sets, the plate calculator and plate-rounded deloads.'
          : 'Use 0 for bodyweight exercises. No warmups or plate math.'}
      </p>
      <div className="sheet-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!d.def.name.trim()} onClick={() => onSave(d)}>
          {isNew ? 'Add exercise' : 'Save'}
        </button>
      </div>
    </Sheet>
  );
}

function AddExerciseSheet({
  state,
  workout,
  onPick,
  onCreate,
  onDelete,
  onClose,
}: {
  state: AppState;
  workout: WorkoutType;
  onPick: (id: ExerciseId) => void;
  onCreate: () => void;
  onDelete: (id: ExerciseId) => void;
  onClose: () => void;
}) {
  const inProgram = new Set([...state.program.A, ...state.program.B]);
  const available = Object.values(state.exercises)
    .filter(def => !state.program[workout].includes(def.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Sheet title={`Add to workout ${workout}`} onClose={onClose}>
      <button className="btn primary wide-block" onClick={onCreate}>+ Create new exercise</button>
      {available.length > 0 && <h3 className="section-label">Your exercises</h3>}
      <ul className="pick-list">
        {available.map(def => (
          <li key={def.id}>
            <button className="pick-item" onClick={() => onPick(def.id)} aria-label={`Add ${def.name}`}>
              <span>{def.name}</span>
              <span className="muted small">{formatScheme(def)}{inProgram.has(def.id) ? ` · in ${state.program.A.includes(def.id) ? 'A' : 'B'}` : ''}</span>
            </button>
            {!isBuiltIn(def.id) && !inProgram.has(def.id) && (
              <button
                className="icon-btn"
                aria-label={`Delete ${def.name}`}
                onClick={() => window.confirm(`Delete ${def.name}? Past workouts keep their records.`) && onDelete(def.id)}
              >
                🗑
              </button>
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function WorkoutEditor({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const [workout, setWorkout] = useState<WorkoutType>('A');
  const [editing, setEditing] = useState<{ draft: Draft; isNew: boolean } | null>(null);
  const [adding, setAdding] = useState(false);
  const { settings, exercises, lifts } = state;
  const u = settings.unit;
  const ids = state.program[workout];

  const setIds = (next: ExerciseId[]) => dispatch({ type: 'setProgram', workout, ids: next });
  const move = (i: number, dir: -1 | 1) => {
    const next = [...ids];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setIds(next);
  };

  const openEdit = (id: ExerciseId) =>
    setEditing({
      isNew: false,
      draft: { def: exercises[id], weight: lifts[id]?.weight ?? startWeight(exercises[id].equipment, settings), addTo: null },
    });

  const openNew = () => {
    setAdding(false);
    setEditing({
      isNew: true,
      draft: {
        def: { id: newId(), name: '', sets: 3, reps: 10, minReps: 8, timed: false, perSide: false, increment: defaultIncrement('', u), equipment: 'barbell' },
        weight: startWeight('barbell', settings),
        addTo: workout,
      },
    });
  };

  const save = ({ def, weight, addTo }: Draft) => {
    dispatch({ type: 'saveExercise', exercise: def, weight });
    if (addTo) dispatch({ type: 'setProgram', workout: addTo, ids: [...state.program[addTo], def.id] });
    setEditing(null);
  };

  return (
    <section className="card">
      <div className="card-title-row">
        <h2 className="card-title">Workouts</h2>
        <div className="segmented" role="radiogroup" aria-label="Workout to edit">
          {(['A', 'B'] as const).map(t => (
            <button key={t} role="radio" aria-checked={workout === t} onClick={() => setWorkout(t)}>
              Workout {t}
            </button>
          ))}
        </div>
      </div>

      <ol className="editor-list" aria-label={`Workout ${workout} exercises`}>
        {ids.map((id, i) => {
          const def = exercises[id];
          return (
            <li key={id}>
              <button className="editor-item" onClick={() => openEdit(id)} aria-label={`Edit ${def.name}`}>
                <span className="editor-name">
                  {def.name}
                  {(lifts[id]?.failures ?? 0) > 0 && <span className="tag failed">{lifts[id].failures}× stalled</span>}
                </span>
                <span className="muted small">
                  {formatScheme(def)} · {formatLoad(lifts[id]?.weight ?? 0, u, def.equipment)} · +{formatWeight(def.increment)}
                  {def.equipment === 'other' && ' · no barbell'}
                </span>
              </button>
              <div className="editor-actions">
                <button className="icon-btn" aria-label={`Move ${def.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="icon-btn" aria-label={`Move ${def.name} down`} disabled={i === ids.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button
                  className="icon-btn"
                  aria-label={`Remove ${def.name} from workout ${workout}`}
                  disabled={ids.length === 1}
                  onClick={() => setIds(ids.filter(x => x !== id))}
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <button className="btn wide-block" onClick={() => setAdding(true)}>+ Add exercise to workout {workout}</button>

      <p className="muted small">
        Changes apply to your next workout that hasn't started. Tap an exercise to change its sets, reps, weight or increment.
      </p>
      <div className="button-row">
        <button
          className="btn small"
          onClick={() => window.confirm('Reset workouts A and B to StrongLifts 5×5? Your weights are kept.') && dispatch({ type: 'applyPreset', preset: '5x5' })}
        >
          Reset to StrongLifts 5×5
        </button>
        <button
          className="btn small"
          onClick={() => window.confirm('Switch workouts A and B to StrongLifts 3×5? Your weights are kept.') && dispatch({ type: 'applyPreset', preset: '3x5' })}
        >
          Use StrongLifts 3×5
        </button>
      </div>

      {adding && (
        <AddExerciseSheet
          state={state}
          workout={workout}
          onClose={() => setAdding(false)}
          onCreate={openNew}
          onDelete={id => dispatch({ type: 'deleteExercise', id })}
          onPick={id => {
            setIds([...ids, id]);
            setAdding(false);
          }}
        />
      )}
      {editing && (
        <ExerciseSheet
          draft={editing.draft}
          isNew={editing.isNew}
          unit={u}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </section>
  );
}
