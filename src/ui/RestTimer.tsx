import { useEffect, useRef } from 'react';
import type { RestState, Settings } from '../types';
import { formatClock, formatRestGuide } from './format';
import { restAlert } from './alert';
import { useNow } from './useNow';

interface RestTimerProps {
  rest: RestState;
  settings: Settings;
  onDismiss: () => void;
}

/** Count-up rest timer, StrongLifts style: guidance depends on whether the last set was missed. */
export function RestTimer({ rest, settings, onDismiss }: RestTimerProps) {
  const now = useNow();
  const elapsed = Math.max(0, (now - rest.startedAt) / 1000);
  const target = rest.failed ? settings.restFailed : settings.restEasy;
  const done = elapsed >= target;

  const alerted = useRef<number | null>(null);
  useEffect(() => {
    if (done && alerted.current !== rest.startedAt) {
      alerted.current = rest.startedAt;
      // Don't beep for timers that ran out while the app was closed.
      if (elapsed - target < 5) restAlert(settings.sound);
    }
  }, [done, rest.startedAt, elapsed, target, settings.sound]);

  const message = done
    ? !rest.failed && elapsed < settings.restHard
      ? `Next set if easy · hard? rest to ${formatClock(settings.restHard)}`
      : 'Time for your next set'
    : rest.failed
      ? `Failed set. Rest ${formatRestGuide(settings.restFailed)}`
      : `Rest ${formatRestGuide(settings.restEasy)} if easy, ${formatRestGuide(settings.restHard)} if hard`;

  return (
    <div className={`rest-timer ${done ? 'done' : ''} ${rest.failed ? 'failed' : ''}`} role="timer" aria-live="polite">
      <div className="rest-progress" style={{ width: `${Math.min(100, (elapsed / target) * 100)}%` }} />
      <span className="rest-clock">{formatClock(elapsed)}</span>
      <span className="rest-message">{message}</span>
      <button className="icon-btn" aria-label="Dismiss rest timer" onClick={onDismiss}>✕</button>
    </div>
  );
}
