import { useRef, useState, type Dispatch } from 'react';
import type { AppState, Settings } from '../types';
import type { Action } from '../state/reducer';
import { WorkoutEditor } from './WorkoutEditor';
import { formatWeight } from '../logic/weights';
import { historyToCsv, parseState } from '../state/storage';
import { NumberField } from './common';
import { downloadFile, readText } from './format';
import { AccountCard } from './AccountCard';
import type { CloudSync } from '../sync/useCloudSync';

export function SettingsScreen({ state, dispatch, cloud }: { state: AppState; dispatch: Dispatch<Action>; cloud: CloudSync }) {
  const { settings } = state;
  const u = settings.unit;
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [platesDraft, setPlatesDraft] = useState(settings.plates.join(', '));
  const [prevPlates, setPrevPlates] = useState(settings.plates);
  if (prevPlates !== settings.plates) {
    setPrevPlates(settings.plates);
    setPlatesDraft(settings.plates.join(', '));
  }

  const update = (s: Partial<Omit<Settings, 'unit'>>) => dispatch({ type: 'updateSettings', settings: s });

  const commitPlates = () => {
    const plates = platesDraft
      .split(/[,\s]+/)
      .map(Number)
      .filter(n => Number.isFinite(n) && n > 0)
      .sort((a, b) => b - a);
    if (plates.length) update({ plates: [...new Set(plates)] });
    else setPlatesDraft(settings.plates.join(', '));
  };

  const stamp = new Date().toISOString().slice(0, 10);

  const importFile = async (file: File) => {
    try {
      const next = parseState(JSON.parse(await readText(file)));
      if (!window.confirm(`Replace all current data with this backup (${next.history.length} workouts)?`)) return;
      dispatch({ type: 'import', state: next });
      setMessage(`Imported ${next.history.length} workouts.`);
    } catch (e) {
      setMessage(`Import failed: ${e instanceof Error ? e.message : 'invalid file'}`);
    }
  };

  return (
    <div className="screen settings">
      <header className="screen-header"><h1>Settings</h1></header>

      <WorkoutEditor state={state} dispatch={dispatch} />

      <section className="card">
        <div className="setting-row">
          <span>Units</span>
          <div className="segmented" role="radiogroup" aria-label="Units">
            {(['kg', 'lb'] as const).map(unit => (
              <button key={unit} role="radio" aria-checked={u === unit} onClick={() => dispatch({ type: 'setUnit', unit })}>{unit}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Deload</h2>
        <label className="setting-row">
          <span>Deload after failed sessions</span>
          <NumberField label="Failures before deload" value={settings.failuresBeforeDeload} min={1} onCommit={v => v != null && update({ failuresBeforeDeload: Math.max(1, Math.round(v)) })} />
        </label>
        <label className="setting-row">
          <span>Deload amount (%)</span>
          <NumberField label="Deload percent" value={settings.deloadPercent} onCommit={v => v != null && update({ deloadPercent: Math.min(50, v) })} />
        </label>
      </section>

      <section className="card">
        <h2 className="card-title">Rest timer (seconds)</h2>
        <label className="setting-row"><span>Easy set</span><NumberField label="Rest after easy set" value={settings.restEasy} step={15} onCommit={v => v != null && update({ restEasy: v })} /></label>
        <label className="setting-row"><span>Hard set</span><NumberField label="Rest after hard set" value={settings.restHard} step={15} onCommit={v => v != null && update({ restHard: v })} /></label>
        <label className="setting-row"><span>Failed set</span><NumberField label="Rest after failed set" value={settings.restFailed} step={15} onCommit={v => v != null && update({ restFailed: v })} /></label>
        <label className="setting-row">
          <span>Sound when rest is over</span>
          <input type="checkbox" className="switch" checked={settings.sound} onChange={e => update({ sound: e.target.checked })} />
        </label>
      </section>

      <section className="card">
        <h2 className="card-title">Equipment ({u})</h2>
        <label className="setting-row">
          <span>Bar weight</span>
          <NumberField label="Bar weight" value={settings.barWeight} step={0.5} onCommit={v => v != null && update({ barWeight: v })} />
        </label>
        <label className="field">
          <span>Plates (one per pair)</span>
          <input
            className="input"
            aria-label="Available plates"
            value={platesDraft}
            onChange={e => setPlatesDraft(e.target.value)}
            onBlur={commitPlates}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </label>
        <p className="muted small">Smallest jump: {formatWeight(Math.min(...settings.plates) * 2)} {u}. Add fractional plates for smaller increments.</p>
      </section>

      <AccountCard cloud={cloud} />

      <section className="card">
        <h2 className="card-title">Backup</h2>
        <div className="button-row">
          <button className="btn" onClick={() => downloadFile(`stronglifts-backup-${stamp}.json`, JSON.stringify(state, null, 2), 'application/json')}>Export backup</button>
          <button className="btn" onClick={() => fileInput.current?.click()}>Import backup</button>
          <button className="btn" onClick={() => downloadFile(`stronglifts-history-${stamp}.csv`, historyToCsv(state.history), 'text/csv')}>Export CSV</button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="import-input"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = '';
          }}
        />
        {message && <p className="small" role="status">{message}</p>}
      </section>

      <section className="card">
        <h2 className="card-title">Danger zone</h2>
        <button
          className="btn danger"
          onClick={() => window.confirm('Delete ALL workouts and settings? This cannot be undone.') && dispatch({ type: 'resetAll' })}
        >
          Reset all data
        </button>
      </section>
    </div>
  );
}
