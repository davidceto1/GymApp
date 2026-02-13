import type { WorkoutSet } from '../types';
import './SetCircle.css';

interface SetCircleProps {
  set: WorkoutSet;
  onClick: () => void;
}

export function SetCircle({ set, onClick }: SetCircleProps) {
  return (
    <div className="set-circle-container" onClick={onClick}>
      <div className={`set-circle ${set.completed ? 'completed' : ''}`}>
        <span className="set-reps">{set.reps}</span>
      </div>
      <span className="set-weight">{set.weight}</span>
    </div>
  );
}
