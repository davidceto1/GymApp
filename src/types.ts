export type Unit = 'kg' | 'lb';
/** Built-in lifts use 'squat' | 'bench' | 'row' | 'ohp' | 'deadlift'; custom ones get generated ids. */
export type ExerciseId = string;
export type WorkoutType = 'A' | 'B';
/** Barbell lifts get warmups, plate math and plate-rounded deloads. */
export type Equipment = 'barbell' | 'other';

export interface ExerciseDef {
  id: ExerciseId;
  name: string;
  sets: number;
  reps: number;
  /** Weight added after a successful session. */
  increment: number;
  equipment: Equipment;
}

export interface Settings {
  unit: Unit;
  barWeight: number;
  /** Available plate sizes (one of each pair), largest first. */
  plates: number[];
  /** Rest guidance in seconds. */
  restEasy: number;
  restHard: number;
  restFailed: number;
  deloadPercent: number;
  failuresBeforeDeload: number;
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
  /** Snapshot so history still reads well if the exercise is renamed or deleted. */
  name: string;
  equipment: Equipment;
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
  version: 2;
  settings: Settings;
  /** Exercise library: every exercise the user can put in a workout. */
  exercises: Record<ExerciseId, ExerciseDef>;
  /** Exercise order for each workout. */
  program: Record<WorkoutType, ExerciseId[]>;
  lifts: Record<ExerciseId, LiftState>;
  nextType: WorkoutType;
  /** Finished workouts, newest first. */
  history: Workout[];
  current: Workout;
}
