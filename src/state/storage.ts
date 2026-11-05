import type { AppState, Workout } from '../types';
import { EXERCISE_IDS, EXERCISE_NAMES, defaultSettings } from '../logic/program';
import { formatWeight } from '../logic/weights';
import { initialState } from './reducer';

export const STORAGE_KEY = 'stronglifts-remake-v1';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isWorkout(v: unknown): v is Workout {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    (v.type === 'A' || v.type === 'B') &&
    Array.isArray(v.exercises) &&
    v.exercises.every(
      e => isObject(e) && typeof e.weight === 'number' && Array.isArray(e.sets),
    )
  );
}

/** Validate untrusted data (localStorage or an imported backup). */
export function parseState(raw: unknown): AppState {
  if (!isObject(raw) || raw.version !== 1) throw new Error('Not a StrongLifts backup (missing version 1).');
  if (!isObject(raw.lifts) || !EXERCISE_IDS.every(id => isObject((raw.lifts as Record<string, unknown>)[id]))) {
    throw new Error('Backup is missing lift data.');
  }
  if (!Array.isArray(raw.history) || !raw.history.every(isWorkout)) {
    throw new Error('Backup history is malformed.');
  }
  if (!isWorkout(raw.current)) throw new Error('Backup current workout is malformed.');
  const unit = isObject(raw.settings) && raw.settings.unit === 'lb' ? 'lb' : 'kg';
  return {
    ...(raw as unknown as AppState),
    // Fill in any settings added after the backup was made.
    settings: { ...defaultSettings(unit), ...(raw.settings as object) },
  };
}

export function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return parseState(JSON.parse(stored));
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return initialState();
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked; nothing sensible to do.
  }
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function historyToCsv(history: Workout[]): string {
  const rows = [['Date', 'Workout', 'Exercise', 'Weight', 'Unit', 'Reps', 'Body Weight', 'Note']];
  for (const w of [...history].reverse()) {
    const date = new Date(w.finishedAt ?? w.startedAt ?? 0).toISOString().slice(0, 10);
    for (const ex of w.exercises) {
      rows.push([
        date,
        w.type,
        EXERCISE_NAMES[ex.id] ?? ex.id,
        formatWeight(ex.weight),
        w.unit,
        ex.sets.map(s => (s.reps === null ? '-' : String(s.reps))).join('/'),
        w.bodyWeight == null ? '' : formatWeight(w.bodyWeight),
        w.note,
      ]);
    }
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
}
