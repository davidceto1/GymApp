import { useState, useEffect } from 'react';
import type { Workout } from '../types';
import { createDefaultWorkout } from '../utils/defaults';

const STORAGE_KEY = 'gymapp-workout';

export function useWorkout() {
  const [workout, setWorkout] = useState<Workout>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as Workout;
    }
    return createDefaultWorkout();
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workout));
  }, [workout]);

  return [workout, setWorkout] as const;
}
