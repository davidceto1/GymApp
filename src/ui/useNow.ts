import { useEffect, useState } from 'react';

/** Re-renders every `interval` ms and returns the current time. */
export function useNow(active = true, interval = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [active, interval]);
  return now;
}
