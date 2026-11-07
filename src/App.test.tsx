import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { STORAGE_KEY } from './state/storage';
import { initialState, reducer } from './state/reducer';
import type { AppState } from './types';

function setup() {
  const user = userEvent.setup();
  render(<App />);
  return user;
}

function card(name: string) {
  return within(screen.getByRole('region', { name }));
}

async function completeAllSets(user: ReturnType<typeof userEvent.setup>) {
  for (const btn of screen.getAllByRole('button', { name: /^Set \d+: not logged/ })) {
    await user.click(btn);
  }
}

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
});

afterEach(() => vi.restoreAllMocks());

describe('Workout screen', () => {
  it('shows workout A with StrongLifts starting weights', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Workout A' })).toBeInTheDocument();
    expect(card('Squat').getByRole('button', { name: /Squat weight/ })).toHaveTextContent('5×5 20kg');
    expect(card('Bench Press').getByRole('button', { name: /weight/ })).toHaveTextContent('5×5 20kg');
    expect(card('Barbell Row').getByRole('button', { name: /weight/ })).toHaveTextContent('5×5 30kg');
  });

  it('cycles reps on tap and starts a rest timer', async () => {
    const user = setup();
    const set1 = () => card('Squat').getByRole('button', { name: /^Set 1:/ });
    await user.click(set1());
    expect(set1()).toHaveAccessibleName('Set 1: 5 reps');
    expect(screen.getByRole('timer')).toHaveTextContent(/Rest 1.5 min if easy, 3 min if hard/);
    await user.click(set1());
    expect(set1()).toHaveAccessibleName('Set 1: 4 reps');
    expect(screen.getByRole('timer')).toHaveTextContent(/Failed set. Rest 5 min/);
    await user.click(screen.getByRole('button', { name: 'Dismiss rest timer' }));
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('finishing a full workout progresses weights and switches to B', async () => {
    const user = setup();
    await completeAllSets(user);
    await user.click(screen.getByRole('button', { name: 'Finish workout' }));
    expect(screen.getByRole('heading', { name: 'Workout B' })).toBeInTheDocument();
    expect(card('Squat').getByRole('button', { name: /weight/ })).toHaveTextContent('22.5kg');
    expect(card('Deadlift').getByRole('button', { name: /weight/ })).toHaveTextContent('1×5 40kg');
    expect(screen.getByRole('status')).toHaveTextContent('Next up: Workout B');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as AppState;
    expect(saved.history).toHaveLength(1);
  });

  it('asks before finishing an incomplete workout', async () => {
    const user = setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(card('Squat').getByRole('button', { name: /^Set 1:/ }));
    await user.click(screen.getByRole('button', { name: 'Finish early' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Workout A' })).toBeInTheDocument();
  });

  it('shows warmup sets and plate calculator, and edits today\'s weight', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reducer(initialState(), { type: 'setLift', id: 'squat', lift: { weight: 100 } })));
    const user = setup();
    await user.click(card('Squat').getByRole('tab', { name: /Warmup/ }));
    expect(card('Squat').getAllByRole('listitem').map(li => li.textContent)).toEqual([
      expect.stringContaining('5×20kg'),
      expect.stringContaining('5×20kg'),
      expect.stringContaining('5×40kg'),
      expect.stringContaining('3×60kg'),
      expect.stringContaining('2×80kg'),
    ]);

    await user.click(card('Squat').getByRole('button', { name: /Squat weight/ }));
    const dialog = within(screen.getByRole('dialog', { name: 'Squat' }));
    expect(dialog.getByTestId('plate-summary')).toHaveTextContent('25 + 15');
    await user.click(dialog.getByRole('button', { name: 'Increase weight' }));
    expect(dialog.getByTestId('plate-summary')).toHaveTextContent('25 + 15 + 1.25');
    await user.click(dialog.getByRole('button', { name: 'Save weight' }));
    expect(card('Squat').getByRole('button', { name: /Squat weight/ })).toHaveTextContent('102.5kg');
  });

  it('offers a deload after a long break', async () => {
    let s = initialState();
    s = reducer(s, { type: 'setLift', id: 'squat', lift: { weight: 100 } });
    s = reducer(s, { type: 'tapSet', exercise: 0, set: 0, now: 0 });
    s = reducer(s, { type: 'finishWorkout', now: Date.now() - 20 * 86_400_000 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    const user = setup();
    expect(screen.getByRole('alert')).toHaveTextContent("It's been 20 days");
    await user.click(screen.getByRole('button', { name: 'Deload 10%' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(card('Squat').getByRole('button', { name: /weight/ })).toHaveTextContent('90kg');
  });

  it('can switch between A and B before starting', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Switch to B' }));
    expect(screen.getByRole('heading', { name: 'Workout B' })).toBeInTheDocument();
  });
});

describe('Rest timer', () => {
  it('counts up and tells you when rest is over', () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      fireEvent.click(card('Squat').getByRole('button', { name: /^Set 1:/ }));
      act(() => vi.advanceTimersByTime(61_000));
      expect(screen.getByRole('timer')).toHaveTextContent('1:01');
      act(() => vi.advanceTimersByTime(30_000));
      expect(screen.getByRole('timer')).toHaveTextContent('Next set if easy · hard? rest to 3:00');
      act(() => vi.advanceTimersByTime(90_000));
      expect(screen.getByRole('timer')).toHaveTextContent('Time for your next set');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Other screens', () => {
  async function finishOne(user: ReturnType<typeof userEvent.setup>) {
    await completeAllSets(user);
    await user.type(screen.getByLabelText('Body weight'), '80{Enter}');
    await user.type(screen.getByPlaceholderText('How did it feel?'), 'Solid');
    await user.click(screen.getByRole('button', { name: 'Finish workout' }));
  }

  it('lists finished workouts in history with details and delete', async () => {
    const user = setup();
    await finishOne(user);
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByText('1 workout')).toBeInTheDocument();
    const head = screen.getByRole('button', { expanded: false });
    expect(head).toHaveTextContent('Squat 5×5 20kg');
    await user.click(head);
    expect(screen.getByText('“Solid”')).toBeInTheDocument();
    expect(screen.getByText(/80 kg/)).toBeInTheDocument();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete workout' }));
    expect(screen.getByText(/No workouts yet/)).toBeInTheDocument();
  });

  it('charts progress per lift and body weight', async () => {
    const user = setup();
    await finishOne(user);
    await user.click(screen.getByRole('button', { name: 'Progress' }));
    expect(screen.getByRole('img', { name: 'Squat chart, 1 points' })).toBeInTheDocument();
    expect(screen.getByText('Next (kg)').previousSibling).toHaveTextContent('22.5');
    await user.click(screen.getByRole('button', { name: 'Show table' }));
    expect(screen.getByRole('table')).toHaveTextContent('5×5: 5 5 5 5 5');
    await user.click(screen.getByRole('tab', { name: 'Body weight' }));
    expect(screen.getByRole('img', { name: 'Body weight chart, 1 points' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Deadlift' }));
    expect(screen.getByText(/No data yet/)).toBeInTheDocument();
  });

  it('settings: switch to lb converts weights; 3×5 preset changes set count', async () => {
    const user = setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('radio', { name: 'lb' }));
    expect(screen.getByLabelText('Bar weight')).toHaveValue(45);
    expect(screen.getByRole('button', { name: 'Edit Squat' })).toHaveTextContent('5×5 · 45lb · +5');
    await user.click(screen.getByRole('button', { name: 'Use StrongLifts 3×5' }));
    await user.click(screen.getByRole('button', { name: 'Workout' }));
    expect(card('Squat').getByRole('button', { name: /weight/ })).toHaveTextContent('3×5 45lb');
    expect(card('Squat').getAllByRole('button', { name: /^Set/ })).toHaveLength(3);
  });

  it('settings: edit working weight and rest time', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Edit Squat' }));
    const sheet = within(screen.getByRole('dialog', { name: 'Edit Squat' }));
    const weight = sheet.getByLabelText('Next weight');
    await user.clear(weight);
    await user.type(weight, '60{Enter}');
    await user.click(sheet.getByRole('button', { name: 'Save' }));
    const rest = screen.getByLabelText('Rest after easy set');
    await user.clear(rest);
    await user.type(rest, '120{Enter}');
    await user.click(screen.getByRole('button', { name: 'Workout' }));
    expect(card('Squat').getByRole('button', { name: /weight/ })).toHaveTextContent('60kg');
    await user.click(card('Squat').getByRole('button', { name: /^Set 1:/ }));
    expect(screen.getByRole('timer')).toHaveTextContent('Rest 2 min if easy');
  });

  it('settings: imports a backup and rejects bad files', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const input = screen.getByTestId('import-input') as HTMLInputElement;

    await user.upload(input, new File(['{"nope":true}'], 'bad.json', { type: 'application/json' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Import failed: Not a StrongLifts backup');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const backup = reducer(initialState(), { type: 'setLift', id: 'bench', lift: { weight: 77.5 } });
    await user.upload(input, new File([JSON.stringify(backup)], 'good.json', { type: 'application/json' }));
    expect(await screen.findByText('Imported 0 workouts.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Bench Press' })).toHaveTextContent('77.5kg');
  });

  it('settings: cloud sync explains it is off when Supabase is not configured', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(card('Cloud sync').getByText(/Not set up/)).toBeInTheDocument();
  });

  it('remembers the selected tab in the URL hash', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(window.location.hash).toBe('#history');
  });
});

describe('Workout editor', () => {
  async function openEditor(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Settings' }));
  }

  function editNames(workout: 'A' | 'B') {
    return within(screen.getByRole('list', { name: `Workout ${workout} exercises` }))
      .getAllByRole('button', { name: /^Edit/ })
      .map(b => b.getAttribute('aria-label'));
  }

  async function fill(input: HTMLElement, value: string, user: ReturnType<typeof userEvent.setup>) {
    await user.clear(input);
    await user.type(input, value);
  }

  it('creates a custom exercise, adds it to workout A and logs it', async () => {
    const user = setup();
    await openEditor(user);
    await user.click(screen.getByRole('button', { name: '+ Add exercise to workout A' }));
    await user.click(screen.getByRole('button', { name: '+ Create new exercise' }));
    const sheet = within(screen.getByRole('dialog', { name: 'New exercise' }));
    await user.type(sheet.getByLabelText('Exercise name'), 'Dips');
    await user.click(sheet.getByRole('radio', { name: 'Dumbbell / other' }));
    await fill(sheet.getByLabelText('Sets'), '3', user);
    await fill(sheet.getByLabelText('Reps'), '10', user);
    await fill(sheet.getByLabelText('Next weight'), '0', user);
    await user.click(sheet.getByRole('button', { name: 'Add exercise' }));

    expect(editNames('A')).toEqual(['Edit Squat', 'Edit Bench Press', 'Edit Barbell Row', 'Edit Dips']);

    await user.click(screen.getByRole('button', { name: 'Workout' }));
    const dips = card('Dips');
    expect(dips.getByRole('button', { name: /Dips weight/ })).toHaveTextContent('3×10 BW');
    expect(dips.queryByRole('tab', { name: /Warmup/ })).not.toBeInTheDocument();
    await user.click(dips.getByRole('button', { name: /^Set 1:/ }));
    expect(dips.getByRole('button', { name: /^Set 1:/ })).toHaveAccessibleName('Set 1: 10 reps');
  });

  it('reorders, removes and re-adds exercises', async () => {
    const user = setup();
    await openEditor(user);
    await user.click(screen.getByRole('radio', { name: 'Workout B' }));
    await user.click(screen.getByRole('button', { name: 'Move Deadlift up' }));
    await user.click(screen.getByRole('button', { name: 'Remove Overhead Press from workout B' }));
    expect(editNames('B')).toEqual(['Edit Squat', 'Edit Deadlift']);

    await user.click(screen.getByRole('button', { name: '+ Add exercise to workout B' }));
    await user.click(screen.getByRole('button', { name: 'Add Barbell Row' }));
    expect(editNames('B')).toEqual(['Edit Squat', 'Edit Deadlift', 'Edit Barbell Row']);

    await user.click(screen.getByRole('button', { name: 'Workout' }));
    await user.click(screen.getByRole('button', { name: 'Switch to B' }));
    const cards = screen.getAllByRole('region').filter(r => r.classList.contains('exercise-card'));
    expect(cards.map(r => r.getAttribute('aria-label'))).toEqual(['Squat', 'Deadlift', 'Barbell Row']);
  });

  it('will not remove the last exercise in a workout', async () => {
    const user = setup();
    await openEditor(user);
    await user.click(screen.getByRole('button', { name: 'Remove Bench Press from workout A' }));
    await user.click(screen.getByRole('button', { name: 'Remove Barbell Row from workout A' }));
    expect(screen.getByRole('button', { name: 'Remove Squat from workout A' })).toBeDisabled();
  });

  it('deletes unused custom exercises but not built-in lifts', async () => {
    const user = setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await openEditor(user);
    await user.click(screen.getByRole('button', { name: '+ Add exercise to workout A' }));
    await user.click(screen.getByRole('button', { name: '+ Create new exercise' }));
    await user.type(screen.getByLabelText('Exercise name'), 'Curls');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.click(screen.getByRole('button', { name: 'Remove Curls from workout A' }));
    await user.click(screen.getByRole('button', { name: '+ Add exercise to workout A' }));
    await user.click(screen.getByRole('button', { name: 'Delete Curls' }));
    expect(screen.queryByRole('button', { name: 'Add Curls' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Overhead Press' })).not.toBeInTheDocument();
  });
});
