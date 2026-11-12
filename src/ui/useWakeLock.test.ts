import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useWakeLock } from './useWakeLock';

function mockWakeLock() {
  const sentinels: { released: boolean; release: ReturnType<typeof vi.fn> }[] = [];
  const request = vi.fn(async () => {
    const s = { released: false, release: vi.fn(async () => { s.released = true; }) };
    sentinels.push(s);
    return s;
  });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return { request, sentinels };
}

let visibility: DocumentVisibilityState = 'visible';

beforeEach(() => {
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { get: () => visibility, configurable: true });
});

afterEach(() => {
  delete (navigator as { wakeLock?: unknown }).wakeLock;
});

const flush = () => act(async () => {});

describe('useWakeLock', () => {
  it('holds the lock while active and releases it when inactive', async () => {
    const { request, sentinels } = mockWakeLock();
    const { rerender } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: false } });
    await flush();
    expect(request).not.toHaveBeenCalled();

    rerender({ on: true });
    await flush();
    expect(request).toHaveBeenCalledWith('screen');

    rerender({ on: false });
    await flush();
    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it('re-acquires the lock when the app comes back to the foreground', async () => {
    const { request, sentinels } = mockWakeLock();
    renderHook(() => useWakeLock(true));
    await flush();
    // The browser drops the lock when the page is hidden.
    visibility = 'hidden';
    sentinels[0].released = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does nothing where the API is missing or the request is denied', async () => {
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
    const request = vi.fn(async () => { throw new Error('denied'); });
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    renderHook(() => useWakeLock(true));
    await flush();
    expect(request).toHaveBeenCalled();
  });
});
