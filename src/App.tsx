import { useEffect, useReducer, useState } from 'react';
import { reducer } from './state/reducer';
import { loadState, saveState } from './state/storage';
import { WorkoutScreen } from './ui/WorkoutScreen';
import { WorkoutSummary } from './ui/WorkoutSummary';
import { HistoryScreen } from './ui/HistoryScreen';
import { ProgressScreen } from './ui/ProgressScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { RestTimer } from './ui/RestTimer';
import { HoldTimer } from './ui/HoldTimer';
import { setMin } from './logic/workout';
import { useCloudSync } from './sync/useCloudSync';
import { useWakeLock } from './ui/useWakeLock';

const TABS = [
  { id: 'workout', label: 'Workout', icon: 'M6 10v4M18 10v4M3 11v2M21 11v2M6 12h12' },
  { id: 'history', label: 'History', icon: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'progress', label: 'Progress', icon: 'M4 18l5-6 4 3 7-9' },
  { id: 'settings', label: 'Settings', icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1' },
] as const;

type Tab = (typeof TABS)[number]['id'];

function tabFromHash(): Tab {
  const h = window.location.hash.slice(1);
  return TABS.some(t => t.id === h) ? (h as Tab) : 'workout';
}

const SUMMARY_KEY = 'gymapp-summary';

function readSummaryId(): string | null {
  try {
    return sessionStorage.getItem(SUMMARY_KEY);
  } catch {
    return null;
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [tab, setTab] = useState<Tab>(tabFromHash);
  /** Workout just finished: the Workout tab shows its summary until dismissed. */
  const [summaryId, setSummaryId] = useState<string | null>(readSummaryId);

  useEffect(() => {
    try {
      if (summaryId) sessionStorage.setItem(SUMMARY_KEY, summaryId);
      else sessionStorage.removeItem(SUMMARY_KEY);
    } catch {
      // Storage unavailable: the summary just won't survive a reload.
    }
  }, [summaryId]);

  const holdMarks = [...new Set(
    state.current.exercises.filter(ex => ex.timed).flatMap(ex => ex.sets.flatMap(s => [setMin(s), s.target])),
  )].sort((x, y) => x - y);

  const showSummary = summaryId != null && state.history.some(w => w.id === summaryId);

  const cloud = useCloudSync(state, dispatch);
  // Keep the screen on from the first logged set until the workout is finished.
  useWakeLock(state.current.startedAt != null);

  useEffect(() => saveState(state), [state]);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, '', `#${t}`);
    window.scrollTo?.(0, 0);
  };

  return (
    <div className="app">
      <main className="app-main">
        {tab === 'workout' && (showSummary
          ? <WorkoutSummary state={state} workoutId={summaryId!} onDone={() => { setSummaryId(null); window.scrollTo?.(0, 0); }} />
          : <WorkoutScreen state={state} dispatch={dispatch} onFinished={id => { setSummaryId(id); window.scrollTo?.(0, 0); }} />)}
        {tab === 'history' && <HistoryScreen state={state} dispatch={dispatch} />}
        {tab === 'progress' && <ProgressScreen state={state} />}
        {tab === 'settings' && <SettingsScreen state={state} dispatch={dispatch} cloud={cloud} />}
      </main>

      <div className="app-bottom">
        <div className="hold-wrap" hidden={tab !== 'workout'}>
          <HoldTimer marks={holdMarks} sound={state.settings.sound} />
        </div>
        {state.current.rest && (
          <RestTimer
            rest={state.current.rest}
            settings={state.settings}
            onDismiss={() => dispatch({ type: 'dismissRest' })}
          />
        )}
        <nav className="tab-bar" aria-label="Main">
          {TABS.map(t => (
            <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} /></svg>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default App;
