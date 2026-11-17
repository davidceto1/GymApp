/**
 * Detects a newer deploy. An installed web app (especially on Android) can stay open for days
 * running the code it first loaded, so an old version can keep syncing with outdated rules.
 * Vite fingerprints the entry bundle (assets/index-<hash>.js), so a changed name in a freshly
 * fetched index.html means a new version is live.
 */
const BUNDLE = /assets\/index-[\w-]+\.js/;

/** The entry bundle this page is running, or null in dev (unbundled) builds. */
export function runningBundle(doc: Document = document): string | null {
  for (const s of Array.from(doc.querySelectorAll<HTMLScriptElement>('script[src]'))) {
    const m = s.getAttribute('src')?.match(BUNDLE);
    if (m) return m[0];
  }
  return null;
}

/** True when the server now serves a different bundle than the one running. Never throws. */
export async function newerVersionAvailable(doc: Document = document): Promise<boolean> {
  const running = runningBundle(doc);
  if (!running) return false;
  try {
    const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const live = (await res.text()).match(BUNDLE)?.[0];
    return live != null && live !== running;
  } catch {
    return false; // Offline: keep running what we have.
  }
}
