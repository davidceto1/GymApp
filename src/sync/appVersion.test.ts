import { afterEach, describe, expect, it, vi } from 'vitest';
import { newerVersionAvailable, runningBundle } from './appVersion';

function page(src: string) {
  const doc = document.implementation.createHTMLDocument();
  const s = doc.createElement('script');
  s.type = 'module';
  s.setAttribute('src', src);
  doc.head.append(s);
  return doc;
}

const serve = (html: string, ok = true) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, text: async () => html })));

describe('app version check', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the running entry bundle', () => {
    expect(runningBundle(page('/assets/index-DuiNT6p0.js'))).toBe('assets/index-DuiNT6p0.js');
    expect(runningBundle(page('/src/main.tsx'))).toBeNull();
  });

  it('reports a newer deploy only when the served bundle differs', async () => {
    const doc = page('/assets/index-old111.js');
    serve('<script type="module" src="/assets/index-new222.js"></script>');
    expect(await newerVersionAvailable(doc)).toBe(true);
    serve('<script type="module" src="/assets/index-old111.js"></script>');
    expect(await newerVersionAvailable(doc)).toBe(false);
  });

  it('stays put offline, on errors and in dev', async () => {
    const doc = page('/assets/index-old111.js');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await newerVersionAvailable(doc)).toBe(false);
    serve('<script src="/assets/index-new222.js"></script>', false);
    expect(await newerVersionAvailable(doc)).toBe(false);
    serve('<script src="/assets/index-new222.js"></script>');
    expect(await newerVersionAvailable(page('/src/main.tsx'))).toBe(false);
  });
});
