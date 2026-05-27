// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpotlightRotation } from '../useSpotlightRotation';

describe('useSpotlightRotation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty set when cap is 0', () => {
    const { result } = renderHook(() =>
      useSpotlightRotation(new Set(['a', 'b']), 0, 15000),
    );
    expect(result.current.size).toBe(0);
  });

  it('returns cap-sized live set from candidates', () => {
    const { result } = renderHook(() =>
      useSpotlightRotation(new Set(['a', 'b', 'c']), 1, 15000),
    );
    expect(result.current.size).toBe(1);
    expect(['a', 'b', 'c']).toContain([...result.current][0]);
  });

  it('rotates after intervalMs and a new id appears in live', () => {
    const { result } = renderHook(() =>
      useSpotlightRotation(new Set(['a', 'b', 'c']), 1, 15000),
    );
    const before = new Set(result.current);
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    const after = new Set(result.current);
    // live set が変化している (= ローテーションが起きた)
    const changed = [...before].some((id) => !after.has(id));
    expect(changed).toBe(true);
  });

  it('does not rotate when intervalMs is 0', () => {
    const { result } = renderHook(() =>
      useSpotlightRotation(new Set(['a', 'b']), 1, 0),
    );
    const before = new Set(result.current);
    act(() => {
      vi.advanceTimersByTime(100000);
    });
    expect(new Set(result.current)).toEqual(before);
  });

  it('reconciles immediately when candidates change', () => {
    const { result, rerender } = renderHook(
      ({ cands }) => useSpotlightRotation(cands, 1, 15000),
      { initialProps: { cands: new Set(['a']) } },
    );
    expect([...result.current]).toEqual(['a']);
    rerender({ cands: new Set(['b']) });
    expect([...result.current]).toEqual(['b']);
  });
});
