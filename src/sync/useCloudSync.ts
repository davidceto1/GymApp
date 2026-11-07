import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppState } from '../types';
import type { Action } from '../state/reducer';
import { supabase } from './supabase';
import { markSynced, push, sync } from './cloud';

export type SyncStatus = 'disabled' | 'signedOut' | 'syncing' | 'synced' | 'offline' | 'error';

export interface CloudSync {
  status: SyncStatus;
  email: string | null;
  error: string | null;
  lastSyncedAt: number | null;
  /** Each returns an error message, or null on success. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  syncNow: () => void;
}

const PUSH_DELAY_MS = 1500;

const message = (e: unknown) => (e instanceof Error ? e.message : 'Sync failed');

/**
 * Keeps localStorage state in sync with Supabase while signed in.
 * The app always runs on local state; this only uploads changes and pulls the cloud copy.
 */
export function useCloudSync(state: AppState, dispatch: Dispatch<Action>): CloudSync {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>('syncing');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const stateRef = useRef(state);
  const busy = useRef(false);
  /** Set once the first full sync for the signed-in user succeeds; pushes wait for it. */
  const ready = useRef(false);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const fail = useCallback((e: unknown) => {
    setStatus(navigator.onLine === false ? 'offline' : 'error');
    setError(message(e));
  }, []);

  const succeed = useCallback(() => {
    setStatus('synced');
    setError(null);
    setLastSyncedAt(Date.now());
  }, []);

  const pushLatest = useCallback(async () => {
    if (!supabase || !userId || !ready.current || busy.current) return;
    busy.current = true;
    try {
      await push(supabase, userId, stateRef.current);
      succeed();
    } catch (e) {
      fail(e);
    } finally {
      busy.current = false;
    }
  }, [userId, succeed, fail]);

  const fullSync = useCallback(async () => {
    if (!supabase || !userId || busy.current) return;
    busy.current = true;
    setStatus('syncing');
    const before = stateRef.current;
    try {
      const next = await sync(supabase, userId, before);
      if (next && stateRef.current === before) {
        dispatch({ type: 'import', state: next });
        markSynced(userId, next);
      }
      ready.current = true;
      succeed();
    } catch (e) {
      fail(e);
    } finally {
      busy.current = false;
    }
    // Upload anything changed while we were syncing.
    if (stateRef.current !== before) void pushLatest();
  }, [userId, dispatch, succeed, fail, pushLatest]);

  // Full sync on sign-in / app start, when coming back online, and when the app is reopened.
  useEffect(() => {
    ready.current = false;
    if (!userId) return;
    void fullSync();
    const onVisible = () => document.visibilityState === 'visible' && void fullSync();
    const onOnline = () => void fullSync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [userId, fullSync]);

  // Upload local edits shortly after they happen.
  useEffect(() => {
    if (!userId) return;
    const t = setTimeout(() => void pushLatest(), PUSH_DELAY_MS);
    return () => clearTimeout(t);
  }, [state, userId, pushLatest]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return 'Cloud sync is not configured.';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) return 'Cloud sync is not configured.';
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    return data.session ? null : 'Check your email to confirm your account, then sign in.';
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setLastSyncedAt(null);
    setError(null);
  };

  return {
    status: !supabase ? 'disabled' : !userId ? 'signedOut' : status,
    email: session?.user.email ?? null,
    error,
    lastSyncedAt,
    signIn,
    signUp,
    signOut,
    syncNow: () => void fullSync(),
  };
}
