// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSkeletonReveal } from '../useSkeletonReveal';

describe('useSkeletonReveal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('読み込み中は false', () => {
    const { result } = renderHook(() => useSkeletonReveal(true));
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(false);
  });

  it('delay 未満で読み込みが終わったら false (アニメなし)', () => {
    const { result, rerender } = renderHook(({ l }) => useSkeletonReveal(l), { initialProps: { l: true } });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ l: false });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(false);
  });

  it('delay 経過後(ダミーが見えた後)に終わったら true、その後も true のまま', () => {
    const { result, rerender } = renderHook(({ l }) => useSkeletonReveal(l), { initialProps: { l: true } });
    act(() => { vi.advanceTimersByTime(250); });
    rerender({ l: false });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe(true);
  });

  it('再読み込み (loading が再び true) で記憶をリセットする', () => {
    const { result, rerender } = renderHook(({ l }) => useSkeletonReveal(l), { initialProps: { l: true } });
    act(() => { vi.advanceTimersByTime(250); });
    rerender({ l: false });
    expect(result.current).toBe(true);
    rerender({ l: true });
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ l: false });
    expect(result.current).toBe(false);
  });
});
