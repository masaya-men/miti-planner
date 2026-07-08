// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useElapsed, formatElapsed, formatClock } from '../useElapsed';

describe('formatElapsed', () => {
  it('分:秒 (ゼロ詰め秒)', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(5)).toBe('0:05');
    expect(formatElapsed(65)).toBe('1:05');
    expect(formatElapsed(600)).toBe('10:00');
  });
  it('60分以上は 時:分:秒', () => {
    expect(formatElapsed(3661)).toBe('1:01:01');
  });
});

describe('formatClock', () => {
  it('24時間 H:MM', () => {
    expect(formatClock(new Date('2026-07-08T14:32:00').getTime())).toBe('14:32');
    expect(formatClock(new Date('2026-07-08T09:05:00').getTime())).toBe('9:05');
  });
});

describe('useElapsed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T14:32:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('null なら 0', () => {
    const { result } = renderHook(() => useElapsed(null));
    expect(result.current).toBe(0);
  });

  it('3秒進めると 3 を返す', () => {
    const start = Date.now();
    const { result } = renderHook(() => useElapsed(start));
    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(3);
  });
});
