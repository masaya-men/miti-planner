// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSlideshowCycle } from '../useSlideshowCycle';

describe('useSlideshowCycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 when frameCount < 2', () => {
    const { result } = renderHook(() => useSlideshowCycle(1));
    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current).toBe(0);
  });

  it('advances index over time when frameCount >= 2', () => {
    const { result } = renderHook(() => useSlideshowCycle(3));
    const initial = result.current;
    act(() => {
      vi.advanceTimersByTime(7000); // > MAX_STEP_MS なので初期 delay + 1 tick は必ず通る
    });
    expect(result.current).not.toBe(initial);
  });

  it('stops when disabled', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useSlideshowCycle(3, enabled),
      { initialProps: { enabled: true } },
    );
    rerender({ enabled: false });
    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current).toBe(0);
  });
});
