import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppState } from '../types';
import {
  diffRows,
  isEmptyDiff,
  mergeHistory,
  mergeUserState,
  rowsToState,
  stateToRows,
  type ExerciseRow,
  type RowDiff,
  type Rows,
  type UserStateRow,
  type WorkoutRow,
} from './rows';

/**
 * What this device last saw in the cloud for a user. Comparing the current state against it
 * tells us exactly which rows to upsert/delete, including changes made while offline.
 */
const snapshotKey = (userId: string) => `gymapp-sync-snapshot:${userId}`;
/** The account this device's local data was last synced with. */
const OWNER_KEY = 'gymapp-sync-owner';

function lastOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function loadSnapshot(userId: string): Rows | null {
  try {
    const raw = localStorage.getItem(snapshotKey(userId));
    return raw ? (JSON.parse(raw) as Rows) : null;
  } catch {
    return null;
  }
}

/** Record that `state` is what the cloud now holds (call after switching the app to it). */
export function markSynced(userId: string, state: AppState) {
  saveSnapshot(userId, stateToRows(state));
}

function saveSnapshot(userId: string, rows: Rows) {
  try {
    localStorage.setItem(snapshotKey(userId), JSON.stringify(rows));
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    // Storage blocked: we'll re-diff against the cloud next time.
  }
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

const USER_STATE_COLUMNS = 'settings, program, lifts, next_type, current';

/**
 * Write `diff` to the cloud. `base` is the user_state this device last synced (null = none).
 * Returns the user_state to record as synced (see mergeUserState).
 */
async function pushDiff(
  db: SupabaseClient,
  userId: string,
  diff: RowDiff,
  base: UserStateRow | null,
): Promise<UserStateRow | null> {
  const own = <T extends object>(rows: T[]) => rows.map(r => ({ ...r, user_id: userId }));
  // Parents/additions first, removals last, so a failure part-way never loses data.
  if (diff.upsertExercises.length) check(await db.from('exercises').upsert(own(diff.upsertExercises)));
  if (diff.upsertWorkouts.length) check(await db.from('workouts').upsert(own(diff.upsertWorkouts)));
  let synced = diff.userState;
  if (diff.userState) {
    // user_state is one row shared by every device: only write the parts this device changed,
    // or a device with an older copy (e.g. a workout left open on a phone) would wipe out
    // edits made elsewhere, like a newly added workout.
    const theirs = base
      ? (check(await db.from('user_state').select(USER_STATE_COLUMNS).eq('user_id', userId).maybeSingle()) as UserStateRow | null)
      : null;
    if (base && theirs) {
      const merge = mergeUserState(base, diff.userState, theirs);
      if (merge.write) check(await db.from('user_state').update(merge.write).eq('user_id', userId));
      synced = merge.snapshot;
    } else {
      check(await db.from('user_state').upsert({ ...diff.userState, user_id: userId }));
    }
  }
  if (diff.deleteWorkouts.length) {
    check(await db.from('workouts').delete().eq('user_id', userId).in('id', diff.deleteWorkouts));
  }
  if (diff.deleteExercises.length) {
    check(await db.from('exercises').delete().eq('user_id', userId).in('id', diff.deleteExercises));
  }
  return synced;
}

/** Upload local changes since the last sync. Returns false when this device has never synced. */
export async function push(db: SupabaseClient, userId: string, state: AppState): Promise<boolean> {
  const snapshot = loadSnapshot(userId);
  if (!snapshot) return false;
  const next = stateToRows(state);
  const diff = diffRows(snapshot, next);
  if (!isEmptyDiff(diff)) {
    const userState = await pushDiff(db, userId, diff, snapshot.userState);
    saveSnapshot(userId, { ...next, userState: userState ?? next.userState });
  }
  return true;
}

/**
 * Full sync: push pending local changes, then download the cloud copy.
 * Returns the state the app should switch to, or null if local state is already current.
 */
export async function sync(db: SupabaseClient, userId: string, local: AppState): Promise<AppState | null> {
  const hadSnapshot = await push(db, userId, local);

  const [us, ex, wo] = await Promise.all([
    db.from('user_state').select(USER_STATE_COLUMNS).eq('user_id', userId).maybeSingle(),
    db.from('exercises').select('id, name, sets, reps, min_reps, timed, per_side, increment, equipment').eq('user_id', userId),
    db.from('workouts').select('id, type, name, unit, started_at, finished_at, exercises, note, body_weight').eq('user_id', userId),
  ]);
  const userState = check(us) as UserStateRow | null;
  const exercises = check(ex) as ExerciseRow[];
  const workouts = check(wo) as WorkoutRow[];

  if (!userState) {
    // Cloud is empty (first sign-in ever): upload everything from this device.
    const rows = stateToRows(local);
    await pushDiff(db, userId, diffRows(null, rows), null);
    saveSnapshot(userId, rows);
    return null;
  }

  let remote = rowsToState(userState, exercises, workouts);
  const owner = lastOwner();
  if (!hadSnapshot && (owner === null || owner === userId)) {
    // First sync on this device: keep cloud settings, but don't drop workouts logged here
    // (unless they belong to a different account that synced from this device before).
    remote = mergeHistory(remote, local);
    const cloudRows = stateToRows(rowsToState(userState, exercises, workouts));
    await pushDiff(db, userId, diffRows(cloudRows, stateToRows(remote)), cloudRows.userState);
  }
  // The caller calls markSynced() once it has switched to `remote`. If it can't (the user changed
  // something meanwhile), the old snapshot stays, so the next push sends only those local edits
  // instead of deleting cloud rows this device never received.
  return remote;
}
