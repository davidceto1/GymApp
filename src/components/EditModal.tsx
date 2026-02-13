import { useState } from 'react';
import type { Exercise, WorkoutSet } from '../types';
import './EditModal.css';

interface EditModalProps {
  exercise: Exercise;
  onSave: (updated: Exercise) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function EditModal({ exercise, onSave, onDelete, onClose }: EditModalProps) {
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState<WorkoutSet[]>(
    exercise.sets.map(s => ({ ...s }))
  );

  const handleSetChange = (index: number, field: 'reps' | 'weight', value: string) => {
    const num = parseFloat(value) || 0;
    setSets(prev => prev.map((s, i) => i === index ? { ...s, [field]: num } : s));
  };

  const addSet = () => {
    const last = sets[sets.length - 1];
    setSets(prev => [...prev, { reps: last?.reps ?? 8, weight: last?.weight ?? 0, completed: false }]);
  };

  const removeSet = (index: number) => {
    if (sets.length <= 1) return;
    setSets(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({ ...exercise, name, sets });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Edit Exercise</h2>

        <label className="modal-label">
          Name
          <input
            className="modal-input"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </label>

        <div className="sets-editor">
          <div className="sets-header">
            <span>Set</span>
            <span>Reps</span>
            <span>Weight (kg)</span>
            <span></span>
          </div>
          {sets.map((set, i) => (
            <div key={i} className="set-row">
              <span className="set-number">{i + 1}</span>
              <input
                className="modal-input small"
                type="number"
                value={set.reps}
                onChange={e => handleSetChange(i, 'reps', e.target.value)}
              />
              <input
                className="modal-input small"
                type="number"
                step="0.5"
                value={set.weight}
                onChange={e => handleSetChange(i, 'weight', e.target.value)}
              />
              <button
                className="remove-set-btn"
                onClick={() => removeSet(i)}
                disabled={sets.length <= 1}
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        <button className="add-set-btn" onClick={addSet}>+ Add Set</button>

        <div className="modal-actions">
          <button className="btn-delete" onClick={onDelete}>Delete Exercise</button>
          <div className="modal-actions-right">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-save" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
