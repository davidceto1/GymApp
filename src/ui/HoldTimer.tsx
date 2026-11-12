import { useEffect, useRef, useState } from 'react';
import { formatClock } from './format';
import { restAlert } from './alert';
import { useNow } from './useNow';

interface HoldTimerProps {
  /** Seconds at which to beep (e.g. the bottom and top of a hold range). */
  marks: number[];
  sound: boolean;
}

/**
 * Floating stopwatch for holds and timed work, independent of set logging and the rest timer.
 * Collapsed it's a round button; expanded it shows the clock with start/pause and reset.
 */
export function HoldTimer({ marks, sound }: HoldTimerProps) {
  const [open, setOpen] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  /** Seconds accumulated before the current run (for pause/resume). */
  const [banked, setBanked] = useState(0);
  const running = startedAt != null;
  const now = useNow(running, 250);
  const elapsed = banked + (running ? Math.max(0, (now - startedAt) / 1000) : 0);

  const alerted = useRef(new Set<number>());
  useEffect(() => {
    if (!running) return;
    for (const mark of marks) {
      if (elapsed >= mark && !alerted.current.has(mark)) {
        alerted.current.add(mark);
        // Skip marks passed long ago (e.g. while the phone was locked).
        if (elapsed - mark < 3) restAlert(sound);
      }
    }
  }, [elapsed, marks, running, sound]);

  const toggle = () => {
    if (running) {
      setBanked(elapsed);
      setStartedAt(null);
    } else {
      setStartedAt(Date.now());
    }
  };
  const reset = () => {
    setStartedAt(null);
    setBanked(0);
    alerted.current.clear();
  };

  if (!open) {
    return (
      <button
        className={`hold-fab ${running ? 'running' : ''}`}
        aria-label={running || elapsed > 0 ? `Hold timer ${formatClock(elapsed)}` : 'Hold timer'}
        onClick={() => setOpen(true)}
      >
        {running || elapsed > 0 ? (
          <span className="hold-fab-clock">{formatClock(elapsed)}</span>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5l3 2M9 2h6M12 4a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" /></svg>
        )}
      </button>
    );
  }

  const next = marks.find(m => m > elapsed);
  const hit = [...marks].reverse().find(m => m <= elapsed);

  return (
    <div className={`hold-timer ${hit != null ? 'hit' : ''}`} role="timer" aria-label="Hold timer">
      <div className="hold-info">
        <span className="hold-clock">{formatClock(elapsed)}</span>
        <span className="muted small">
          Hold
          {marks.length > 0 && (next != null ? ` · beeps at ${formatClock(next)}` : ` · past ${formatClock(hit!)}`)}
        </span>
      </div>
      <button className="btn small" onClick={reset} disabled={elapsed === 0}>Reset</button>
      <button className="btn primary small hold-toggle" onClick={toggle}>
        {running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
      </button>
      <button className="icon-btn" aria-label="Minimize hold timer" onClick={() => setOpen(false)}>–</button>
    </div>
  );
}
