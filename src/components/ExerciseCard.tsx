import type { Exercise } from '../types';
import { SetCircle } from './SetCircle';
import './ExerciseCard.css';

interface ExerciseCardProps {
  exercise: Exercise;
  onToggleSet: (setIndex: number) => void;
  onEdit: () => void;
}

export function ExerciseCard({ exercise, onToggleSet, onEdit }: ExerciseCardProps) {
  const { sets } = exercise;
  const totalSets = sets.length;
  const reps = sets[0]?.reps ?? 0;
  const maxWeight = Math.max(...sets.map(s => s.weight));
  const allSameWeight = sets.every(s => s.weight === sets[0]?.weight);

  const summary = allSameWeight
    ? `${totalSets}\u00d7${reps} ${maxWeight}kg`
    : `${totalSets}\u00d7${maxWeight}kg`;

  return (
    <div className="exercise-card">
      <div className="exercise-header">
        <span className="exercise-name">{exercise.name}</span>
        <button className="exercise-summary" onClick={onEdit}>
          {summary} <span className="arrow">&rsaquo;</span>
        </button>
      </div>
      <div className="sets-row">
        {sets.map((set, i) => (
          <SetCircle key={i} set={set} onClick={() => onToggleSet(i)} />
        ))}
      </div>
    </div>
  );
}
