export type Unit = 'kg' | 'lb';
/** Built-in lifts use 'squat' | 'bench' | 'row' | 'ohp' | 'deadlift'; custom ones get generated ids. */
export type ExerciseId = string;
/** Id of a workout in the program ('A'–'E'); stays fixed when the workout is renamed. */
export type WorkoutType = string;
/** Barbell lifts get warmups, plate math and plate-rounded deloads. */
export type Equipment = 'barbell' | 'other';

export interface ExerciseDef {
  id: ExerciseId;
  name: string;
  sets: number;
  /** Top of the rep range (seconds for timed exercises). */
  reps: number;
  /** Bottom of the rep range; equal to `reps` for a fixed target like 5×5. */
  minReps: number;
  /** Sets are holds measured in seconds instead of reps. */
  timed: boolean;
  /** Reps/seconds are per side (single-arm or single-leg work). */
  perSide: boolean;
  /** Weight added once every set reaches the top of the range. */
  increment: number;
  equipment: Equipment;
}

/** One workout in the rotation. */
export interface WorkoutDef {
  id: WorkoutType;
  name: string;
  /** Exercise order. */
  exercises: ExerciseId[];
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
  /** Consecutive sessions at the current weight without progress (missed reps or no rep gain). */
  failures: number;
  /** Most total reps logged in one session at the current weight, for double progression. */
  bestReps?: number;
}

export interface LoggedSet {
  /** Top of the range: the value a tap fills in. */
  target: number;
  /** Bottom of the range; less counts as missed. Absent on older workouts (same as target). */
  min?: number;
  /** null = not logged yet. */
  reps: number | null;
}

export interface SessionExercise {
  id: ExerciseId;
  /** Snapshot so history still reads well if the exercise is renamed or deleted. */
  name: string;
  equipment: Equipment;
  timed?: boolean;
  perSide?: boolean;
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
  /** Snapshot of the workout's name; absent on older workouts (shown as "Workout <type>"). */
  name?: string;
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
  /** The workouts in rotation order (1–5). */
  program: WorkoutDef[];
  lifts: Record<ExerciseId, LiftState>;
  nextType: WorkoutType;
  /** Finished workouts, newest first. */
  history: Workout[];
  current: Workout;
}
