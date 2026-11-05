import { useState } from 'react';
import type { SessionExercise, Settings } from '../types';
import { formatWeight, plateBreakdown, smallestStep } from '../logic/weights';
import { NumberField, Sheet } from './common';

interface WeightSheetProps {
  exercise: SessionExercise;
  settings: Settings;
  onSave: (weight: number) => void;
  onClose: () => void;
}

/** Plate calculator + "change today's weight". */
export function WeightSheet({ exercise, settings, onSave, onClose }: WeightSheetProps) {
  const [weight, setWeight] = useState(exercise.weight);
  const barbell = exercise.equipment === 'barbell';
  const step = barbell ? smallestStep(settings) : settings.unit === 'kg' ? 1 : 2.5;
  const { perSide, remainder } = plateBreakdown(weight, settings.barWeight, settings.plates);
  const u = settings.unit;
  const maxPlate = Math.max(...settings.plates);

  return (
    <Sheet title={exercise.name} onClose={onClose}>
      <div className="weight-stepper">
        <button className="round-btn" aria-label="Decrease weight" onClick={() => setWeight(w => Math.max(0, Math.round((w - step) * 1000) / 1000))}>−</button>
        <NumberField className="weight-input" label="Weight" value={weight} step={step} onCommit={v => v != null && setWeight(v)} />
        <span className="unit">{u}</span>
        <button className="round-btn" aria-label="Increase weight" onClick={() => setWeight(w => Math.round((w + step) * 1000) / 1000)}>+</button>
      </div>

      {barbell ? (
        <>
          <h3 className="section-label">Plates per side</h3>
          <div className="barbell" aria-label="Plate diagram">
            <div className="bar-sleeve" />
            {perSide.map((p, i) => (
              <div
                key={i}
                className="plate"
                style={{ height: `${40 + (p / maxPlate) * 60}%` }}
                title={`${formatWeight(p)} ${u}`}
              >
                <span>{formatWeight(p)}</span>
              </div>
            ))}
          </div>
          <p className="plate-summary" data-testid="plate-summary">
            {perSide.length === 0
              ? weight <= settings.barWeight
                ? `Empty bar (${formatWeight(settings.barWeight)} ${u})`
                : 'No plates'
              : perSide.map(formatWeight).join(' + ')}
            {remainder > 0 && ` (can't load ${formatWeight(remainder * 2)} ${u} with your plates)`}
          </p>
          <p className="muted small">Bar {formatWeight(settings.barWeight)} {u} · change bar and plates in Settings</p>
        </>
      ) : (
        <p className="muted small">Not a barbell lift, so there are no plates to load. Use 0 for bodyweight-only.</p>
      )}

      <div className="sheet-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onSave(weight)} disabled={weight === exercise.weight}>
          Save weight
        </button>
      </div>
    </Sheet>
  );
}
