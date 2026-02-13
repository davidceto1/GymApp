import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkout } from './useWorkouts';

const STORAGE_KEY = 'gymapp-workout';

describe('useWorkout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default workout when localStorage is empty', () => {
    const { result } = renderHook(() => useWorkout());
    const [workout] = result.current;

    expect(workout.name).toBe('Workout');
    expect(workout.exercises).toHaveLength(3);
    expect(workout.exercises[0].name).toBe('Deadlift');
    expect(workout.exercises[1].name).toBe('Dumbbell Bench Press');
    expect(workout.exercises[2].name).toBe('Incline Board Press');
  });

  it('persists workout to localStorage', () => {
    const { result } = renderHook(() => useWorkout());

    act(() => {
      const [workout, setWorkout] = result.current;
      setWorkout({ ...workout, name: 'My Custom Workout' });
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.name).toBe('My Custom Workout');
  });

  it('loads workout from localStorage', () => {
    const saved = {
      id: 'test-id',
      name: 'Saved Workout',
      date: '2026-01-01',
      exercises: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const { result } = renderHook(() => useWorkout());
    const [workout] = result.current;

    expect(workout.name).toBe('Saved Workout');
    expect(workout.id).toBe('test-id');
  });
});
