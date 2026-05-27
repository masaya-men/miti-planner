// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLongPressConfirm } from '../useLongPressConfirm';

describe('useLongPressConfirm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('start → 完了時間到達で onConfirm が呼ばれる', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() =>
      useLongPressConfirm({ duration: 2000, onConfirm }),
    );

    act(() => {
      result.current.start();
    });
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('start → cancel で onConfirm が呼ばれない', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() =>
      useLongPressConfirm({ duration: 2000, onConfirm }),
    );

    act(() => {
      result.current.start();
      vi.advanceTimersByTime(1000);
      result.current.cancel();
      vi.advanceTimersByTime(2000);
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('progress が 0 → 1 へ単調増加 (start 後 advance)', () => {
    const { result } = renderHook(() =>
      useLongPressConfirm({ duration: 2000, onConfirm: vi.fn() }),
    );

    expect(result.current.progress).toBe(0);
    act(() => {
      result.current.start();
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.progress).toBeGreaterThan(0.4);
    expect(result.current.progress).toBeLessThan(0.6);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.progress).toBe(1);
  });

  it('cancel 後は progress が 0 に戻る', () => {
    const { result } = renderHook(() =>
      useLongPressConfirm({ duration: 2000, onConfirm: vi.fn() }),
    );

    act(() => {
      result.current.start();
      vi.advanceTimersByTime(1000);
      result.current.cancel();
    });
    expect(result.current.progress).toBe(0);
    expect(result.current.isPressing).toBe(false);
  });

  it('2 回 start しても 1 回しか confirm しない', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() =>
      useLongPressConfirm({ duration: 2000, onConfirm }),
    );

    act(() => {
      result.current.start();
      result.current.start();
      vi.advanceTimersByTime(2000);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
