import type { Workout } from '../types';

export function createDefaultWorkout(): Workout {
  return {
    id: crypto.randomUUID(),
    name: 'Workout',
    date: new Date().toISOString().split('T')[0],
    exercises: [
      {
        id: crypto.randomUUID(),
        name: 'Deadlift',
        sets: [
          { reps: 5, weight: 85, completed: false },
          { reps: 5, weight: 75, completed: false },
          { reps: 5, weight: 75, completed: false },
          { reps: 5, weight: 75, completed: false },
          { reps: 5, weight: 75, completed: false },
        ],
      },
      {
        id: crypto.randomUUID(),
        name: 'Dumbbell Bench Press',
        sets: [
          { reps: 8, weight: 7.5, completed: false },
          { reps: 8, weight: 7.5, completed: false },
          { reps: 8, weight: 7.5, completed: false },
          { reps: 8, weight: 7.5, completed: false },
          { reps: 8, weight: 7.5, completed: false },
        ],
      },
      {
        id: crypto.randomUUID(),
        name: 'Incline Board Press',
        sets: [
          { reps: 8, weight: 42.5, completed: false },
          { reps: 8, weight: 37.5, completed: false },
          { reps: 8, weight: 37.5, completed: false },
          { reps: 8, weight: 37.5, completed: false },
          { reps: 8, weight: 37.5, completed: false },
        ],
      },
    ],
  };
}
