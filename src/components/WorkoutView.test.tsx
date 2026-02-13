import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkoutView } from './WorkoutView';
import type { Workout } from '../types';

const mockWorkout: Workout = {
  id: 'w-1',
  name: 'Push Day',
  date: '2026-02-13',
  exercises: [
    {
      id: 'ex-1',
      name: 'Bench Press',
      sets: [
        { reps: 8, weight: 60, completed: false },
        { reps: 8, weight: 60, completed: false },
      ],
    },
    {
      id: 'ex-2',
      name: 'Overhead Press',
      sets: [
        { reps: 5, weight: 40, completed: false },
      ],
    },
  ],
};

describe('WorkoutView', () => {
  it('renders workout name', () => {
    render(<WorkoutView workout={mockWorkout} onUpdate={() => {}} />);
    expect(screen.getByText('Push Day')).toBeInTheDocument();
  });

  it('renders all exercises', () => {
    render(<WorkoutView workout={mockWorkout} onUpdate={() => {}} />);
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Overhead Press')).toBeInTheDocument();
  });

  it('renders add exercise button', () => {
    render(<WorkoutView workout={mockWorkout} onUpdate={() => {}} />);
    expect(screen.getByText('+ Add Exercise')).toBeInTheDocument();
  });

  it('toggles set completion when circle is clicked', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(<WorkoutView workout={mockWorkout} onUpdate={onUpdate} />);

    const reps = screen.getAllByText('8');
    await user.click(reps[0]);

    expect(onUpdate).toHaveBeenCalledOnce();
    const updated = onUpdate.mock.calls[0][0];
    expect(updated.exercises[0].sets[0].completed).toBe(true);
  });

  it('adds an exercise when add button is clicked', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(<WorkoutView workout={mockWorkout} onUpdate={onUpdate} />);

    await user.click(screen.getByText('+ Add Exercise'));

    expect(onUpdate).toHaveBeenCalledOnce();
    const updated = onUpdate.mock.calls[0][0];
    expect(updated.exercises).toHaveLength(3);
    expect(updated.exercises[2].name).toBe('New Exercise');
  });

  it('allows editing workout name by clicking it', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(<WorkoutView workout={mockWorkout} onUpdate={onUpdate} />);

    await user.click(screen.getByText('Push Day'));

    const input = screen.getByDisplayValue('Push Day');
    await user.clear(input);
    await user.type(input, 'Leg Day');
    await user.keyboard('{Enter}');

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Leg Day' })
    );
  });
});
