import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditModal } from './EditModal';
import type { Exercise } from '../types';

const mockExercise: Exercise = {
  id: 'ex-1',
  name: 'Bench Press',
  sets: [
    { reps: 8, weight: 60, completed: false },
    { reps: 8, weight: 60, completed: false },
  ],
};

describe('EditModal', () => {
  it('renders exercise name in input', () => {
    render(
      <EditModal exercise={mockExercise} onSave={() => {}} onDelete={() => {}} onClose={() => {}} />
    );

    expect(screen.getByDisplayValue('Bench Press')).toBeInTheDocument();
  });

  it('renders all sets with reps and weight inputs', () => {
    render(
      <EditModal exercise={mockExercise} onSave={() => {}} onDelete={() => {}} onClose={() => {}} />
    );

    const repsInputs = screen.getAllByDisplayValue('8');
    const weightInputs = screen.getAllByDisplayValue('60');
    expect(repsInputs).toHaveLength(2);
    expect(weightInputs).toHaveLength(2);
  });

  it('adds a new set when + Add Set is clicked', async () => {
    const user = userEvent.setup();

    render(
      <EditModal exercise={mockExercise} onSave={() => {}} onDelete={() => {}} onClose={() => {}} />
    );

    await user.click(screen.getByText('+ Add Set'));

    const repsInputs = screen.getAllByDisplayValue('8');
    expect(repsInputs).toHaveLength(3);
  });

  it('calls onSave with updated data', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <EditModal exercise={mockExercise} onSave={onSave} onDelete={() => {}} onClose={() => {}} />
    );

    const nameInput = screen.getByDisplayValue('Bench Press');
    await user.clear(nameInput);
    await user.type(nameInput, 'Squat');
    await user.click(screen.getByText('Save'));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0].name).toBe('Squat');
  });

  it('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <EditModal exercise={mockExercise} onSave={() => {}} onDelete={onDelete} onClose={() => {}} />
    );

    await user.click(screen.getByText('Delete Exercise'));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <EditModal exercise={mockExercise} onSave={() => {}} onDelete={() => {}} onClose={onClose} />
    );

    await user.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
