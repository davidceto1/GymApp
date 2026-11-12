import { useEffect } from 'react';

/**
 * Keep the screen on while `active` (Screen Wake Lock API). The browser drops the lock when
 * the page is hidden, so it's re-acquired when the app comes back to the foreground.
 * Does nothing where the API is unsupported.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
        else sentinel = lock;
      } catch {
        // Denied (e.g. battery saver) or unsupported: the screen just times out as usual.
      }
    };
    const onVisibility = () => void acquire();

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
