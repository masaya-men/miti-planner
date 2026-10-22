// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDelayedFlag } from '../useDelayedFlag';

describe('useDelayedFlag', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('true になって 200ms 経つまでは false、経過後に true', () => {
    const { result } = renderHook(() => useDelayedFlag(true));
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(199); });
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(true);
  });

  it('200ms 以内に false へ戻れば一度も true にならない', () => {
    const { result, rerender } = renderHook(({ f }) => useDelayedFlag(f), { initialProps: { f: true } });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ f: false });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(false);
  });

  it('true の後 false に戻ったら即 false', () => {
    const { result, rerender } = renderHook(({ f }) => useDelayedFlag(f), { initialProps: { f: true } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe(true);
    rerender({ f: false });
    expect(result.current).toBe(false);
  });
});
