// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsScrolling } from '../useIsScrolling';

describe('useIsScrolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false initially', () => {
    const { result } = renderHook(() => useIsScrolling(150));
    expect(result.current).toBe(false);
  });

  it('returns true on scroll, false after debounce', () => {
    const { result } = renderHook(() => useIsScrolling(150));
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(false);
  });

  it('extends timer when scroll fires again before debounce', () => {
    const { result } = renderHook(() => useIsScrolling(150));
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    act(() => {
      vi.advanceTimersByTime(100);
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(false);
  });

  // 実際のスクロール容器は一覧グリッド (.housing-listing-grid, overflow-y:auto)。
  // body は overflow:hidden なので scroll は window にバブルしない → capture で拾う必要がある。
  it('内側のスクロールコンテナで発火した scroll も捕捉する (capture)', () => {
    const inner = document.createElement('div');
    document.body.appendChild(inner);
    const { result } = renderHook(() => useIsScrolling(150));
    act(() => {
      // scroll はバブルしない (bubbles:false)。capture していなければ window では拾えない。
      inner.dispatchEvent(new Event('scroll', { bubbles: false }));
    });
    expect(result.current).toBe(true);
    document.body.removeChild(inner);
  });
});
