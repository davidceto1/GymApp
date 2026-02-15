import { useState, useEffect, useCallback } from 'react';
import './RestTimer.css';

const REST_DURATION = 120; // 2 minutes in seconds

interface RestTimerProps {
  trigger: number; // incremented each time a set is completed
}

export function RestTimer({ trigger }: RestTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [active, setActive] = useState(false);

  const dismiss = useCallback(() => {
    setActive(false);
    setSecondsLeft(0);
  }, []);

  // Start timer when trigger changes (but not on mount)
  useEffect(() => {
    if (trigger === 0) return;
    setSecondsLeft(REST_DURATION);
    setActive(true);
  }, [trigger]);

  // Countdown
  useEffect(() => {
    if (!active) return;
    if (secondsLeft <= 0) {
      setActive(false);
      return;
    }
    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          setActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active, secondsLeft <= 0]);

  if (!active) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const progress = secondsLeft / REST_DURATION;

  return (
    <div className="rest-timer-overlay" onClick={dismiss}>
      <div className="rest-timer" onClick={e => e.stopPropagation()}>
        <span className="rest-timer-label">Rest</span>
        <div className="rest-timer-ring">
          <svg viewBox="0 0 100 100">
            <circle className="rest-timer-track" cx="50" cy="50" r="45" />
            <circle
              className="rest-timer-progress"
              cx="50"
              cy="50"
              r="45"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress)}`}
            />
          </svg>
          <span className="rest-timer-display">{display}</span>
        </div>
        <button className="rest-timer-skip" onClick={dismiss}>
          Skip
        </button>
      </div>
    </div>
  );
}
