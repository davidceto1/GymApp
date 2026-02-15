import { useState } from 'react';
import type { Workout, Exercise } from '../types';
import { ExerciseCard } from './ExerciseCard';
import { EditModal } from './EditModal';
import { RestTimer } from './RestTimer';
import './WorkoutView.css';

interface WorkoutViewProps {
  workout: Workout;
  onUpdate: (workout: Workout) => void;
}

export function WorkoutView({ workout, onUpdate }: WorkoutViewProps) {
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(workout.name);

  const [timerTrigger, setTimerTrigger] = useState(0);

  const editingExercise = workout.exercises.find(e => e.id === editingExerciseId);

  const toggleSet = (exerciseId: string, setIndex: number) => {
    const exercise = workout.exercises.find(ex => ex.id === exerciseId);
    const wasCompleted = exercise?.sets[setIndex]?.completed;

    onUpdate({
      ...workout,
      exercises: workout.exercises.map(ex =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((s, i) =>
                i === setIndex ? { ...s, completed: !s.completed } : s
              ),
            }
          : ex
      ),
    });

    // Start rest timer only when completing a set (not when uncompleting)
    if (!wasCompleted) {
      setTimerTrigger(prev => prev + 1);
    }
  };

  const updateExercise = (updated: Exercise) => {
    onUpdate({
      ...workout,
      exercises: workout.exercises.map(ex =>
        ex.id === updated.id ? updated : ex
      ),
    });
    setEditingExerciseId(null);
  };

  const deleteExercise = (id: string) => {
    onUpdate({
      ...workout,
      exercises: workout.exercises.filter(ex => ex.id !== id),
    });
    setEditingExerciseId(null);
  };

  const addExercise = () => {
    const newExercise: Exercise = {
      id: crypto.randomUUID(),
      name: 'New Exercise',
      sets: [{ reps: 8, weight: 20, completed: false }],
    };
    onUpdate({
      ...workout,
      exercises: [...workout.exercises, newExercise],
    });
    setEditingExerciseId(newExercise.id);
  };

  const handleNameBlur = () => {
    setEditingName(false);
    if (nameValue.trim() && nameValue !== workout.name) {
      onUpdate({ ...workout, name: nameValue.trim() });
    } else {
      setNameValue(workout.name);
    }
  };

  return (
    <div className="workout-view">
      <div className="workout-header">
        {editingName ? (
          <input
            className="workout-name-input"
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={e => e.key === 'Enter' && handleNameBlur()}
            autoFocus
          />
        ) : (
          <h1 className="workout-name" onClick={() => setEditingName(true)}>
            {workout.name}
          </h1>
        )}
      </div>

      <div className="workout-divider" />

      {workout.exercises.map(exercise => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          onToggleSet={setIndex => toggleSet(exercise.id, setIndex)}
          onEdit={() => setEditingExerciseId(exercise.id)}
        />
      ))}

      <button className="add-exercise-btn" onClick={addExercise}>
        + Add Exercise
      </button>

      {editingExercise && (
        <EditModal
          exercise={editingExercise}
          onSave={updateExercise}
          onDelete={() => deleteExercise(editingExercise.id)}
          onClose={() => setEditingExerciseId(null)}
        />
      )}

      <RestTimer trigger={timerTrigger} />
    </div>
  );
}
