import { useEffect, useReducer, useState } from 'react';
import { reducer } from './state/reducer';
import { loadState, saveState } from './state/storage';
import { WorkoutScreen } from './ui/WorkoutScreen';
import { HistoryScreen } from './ui/HistoryScreen';
import { ProgressScreen } from './ui/ProgressScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { RestTimer } from './ui/RestTimer';
import { useCloudSync } from './sync/useCloudSync';

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

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [tab, setTab] = useState<Tab>(tabFromHash);

  const cloud = useCloudSync(state, dispatch);

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
        {tab === 'workout' && <WorkoutScreen state={state} dispatch={dispatch} />}
        {tab === 'history' && <HistoryScreen state={state} dispatch={dispatch} />}
        {tab === 'progress' && <ProgressScreen state={state} />}
        {tab === 'settings' && <SettingsScreen state={state} dispatch={dispatch} cloud={cloud} />}
      </main>

      <div className="app-bottom">
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
