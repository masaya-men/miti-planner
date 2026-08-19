// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFallingHousesCycle } from '../useFallingHousesCycle';
import { MIN_HOUSES, MAX_HOUSES, phaseDurationMs } from '../fallingHousesCycle';

describe('useFallingHousesCycle (2026-08-19 Allmarksまとめてインポート演出)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('初期状態: falling フェーズ、家の数は4〜6件、reducedMotion=false', () => {
    const { result } = renderHook(() => useFallingHousesCycle());
    expect(result.current.phase).toBe('falling');
    expect(result.current.houses.length).toBeGreaterThanOrEqual(MIN_HOUSES);
    expect(result.current.houses.length).toBeLessThanOrEqual(MAX_HOUSES);
    expect(result.current.reducedMotion).toBe(false);
  });

  it('falling の持ち時間が過ぎると path フェーズへ進む', () => {
    const { result } = renderHook(() => useFallingHousesCycle());
    const fallDuration = phaseDurationMs('falling', result.current.houses.length);
    act(() => {
      vi.advanceTimersByTime(fallDuration + 10);
    });
    expect(result.current.phase).toBe('path');
  });

  it('fading まで進んだ後は cycleId が進み falling に戻る(無限ループ)', () => {
    const { result } = renderHook(() => useFallingHousesCycle());
    const firstCycleId = result.current.cycleId;
    const houseCount = result.current.houses.length;
    const totalMs =
      phaseDurationMs('falling', houseCount) +
      phaseDurationMs('path', houseCount) +
      phaseDurationMs('walking', houseCount) +
      phaseDurationMs('hold', houseCount) +
      phaseDurationMs('fading', houseCount) +
      10;
    act(() => {
      vi.advanceTimersByTime(totalMs);
    });
    expect(result.current.phase).toBe('falling');
    expect(result.current.cycleId).toBe(firstCycleId + 1);
  });

  it('prefers-reduced-motion のときはタイマーを起動せず falling のまま止まる', () => {
    const originalMatchMedia = window.matchMedia;
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);

    const { result } = renderHook(() => useFallingHousesCycle());
    expect(result.current.reducedMotion).toBe(true);
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(result.current.phase).toBe('falling');
    expect(result.current.cycleId).toBe(0);

    window.matchMedia = originalMatchMedia;
  });

  it('アンマウントするとタイマーが解除される(残タイマー無し)', () => {
    const { unmount } = renderHook(() => useFallingHousesCycle());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
