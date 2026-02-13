import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseCard } from './ExerciseCard';
import type { Exercise } from '../types';

const mockExercise: Exercise = {
  id: 'ex-1',
  name: 'Deadlift',
  sets: [
    { reps: 5, weight: 85, completed: false },
    { reps: 5, weight: 85, completed: false },
    { reps: 5, weight: 85, completed: true },
  ],
};

describe('ExerciseCard', () => {
  it('renders exercise name', () => {
    render(
      <ExerciseCard exercise={mockExercise} onToggleSet={() => {}} onEdit={() => {}} />
    );

    expect(screen.getByText('Deadlift')).toBeInTheDocument();
  });

  it('renders summary with sets, reps and weight', () => {
    render(
      <ExerciseCard exercise={mockExercise} onToggleSet={() => {}} onEdit={() => {}} />
    );

    expect(screen.getByText(/3×5 85kg/)).toBeInTheDocument();
  });

  it('renders all set circles', () => {
    render(
      <ExerciseCard exercise={mockExercise} onToggleSet={() => {}} onEdit={() => {}} />
    );

    const repsElements = screen.getAllByText('5');
    expect(repsElements).toHaveLength(3);
  });

  it('calls onToggleSet with correct index when a set is clicked', async () => {
    const user = userEvent.setup();
    const onToggleSet = vi.fn();

    render(
      <ExerciseCard exercise={mockExercise} onToggleSet={onToggleSet} onEdit={() => {}} />
    );

    const circles = screen.getAllByText('5');
    await user.click(circles[1]);
    expect(onToggleSet).toHaveBeenCalledWith(1);
  });

  it('calls onEdit when summary button is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <ExerciseCard exercise={mockExercise} onToggleSet={() => {}} onEdit={onEdit} />
    );

    await user.click(screen.getByRole('button'));
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
