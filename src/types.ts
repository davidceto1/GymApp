export type Unit = 'kg' | 'lb';
export type ExerciseId = 'squat' | 'bench' | 'row' | 'ohp' | 'deadlift';
export type WorkoutType = 'A' | 'B';
export type ProgramVariant = '5x5' | '3x5';

export interface Settings {
  unit: Unit;
  barWeight: number;
  /** Available plate sizes (one of each pair), largest first. */
  plates: number[];
  /** Rest guidance in seconds. */
  restEasy: number;
  restHard: number;
  restFailed: number;
  increments: Record<ExerciseId, number>;
  deloadPercent: number;
  failuresBeforeDeload: number;
  program: ProgramVariant;
  sound: boolean;
}

export interface LiftState {
  weight: number;
  /** Consecutive failed sessions at the current weight. */
  failures: number;
}

export interface LoggedSet {
  target: number;
  /** null = not logged yet. */
  reps: number | null;
}

export interface SessionExercise {
  id: ExerciseId;
  weight: number;
  sets: LoggedSet[];
}

export interface RestState {
  startedAt: number;
  failed: boolean;
}

export interface Workout {
  id: string;
  type: WorkoutType;
  unit: Unit;
  /** Epoch ms of the first logged set. */
  startedAt: number | null;
  finishedAt: number | null;
  exercises: SessionExercise[];
  note: string;
  bodyWeight: number | null;
  rest: RestState | null;
  /** Break-deload prompt already accepted or skipped for this session. */
  breakDeloadHandled: boolean;
}

export interface AppState {
  version: 1;
  settings: Settings;
  lifts: Record<ExerciseId, LiftState>;
  nextType: WorkoutType;
  /** Finished workouts, newest first. */
  history: Workout[];
  current: Workout;
}
