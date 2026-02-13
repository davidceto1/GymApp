import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetCircle } from './SetCircle';

describe('SetCircle', () => {
  it('renders reps and weight', () => {
    render(
      <SetCircle set={{ reps: 5, weight: 85, completed: false }} onClick={() => {}} />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('applies completed class when set is completed', () => {
    const { container } = render(
      <SetCircle set={{ reps: 5, weight: 85, completed: true }} onClick={() => {}} />
    );

    expect(container.querySelector('.set-circle')).toHaveClass('completed');
  });

  it('does not apply completed class when set is not completed', () => {
    const { container } = render(
      <SetCircle set={{ reps: 5, weight: 85, completed: false }} onClick={() => {}} />
    );

    expect(container.querySelector('.set-circle')).not.toHaveClass('completed');
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <SetCircle set={{ reps: 8, weight: 40, completed: false }} onClick={onClick} />
    );

    await user.click(screen.getByText('8'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
