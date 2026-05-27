// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewportPlaybackPool } from '../useViewportPlaybackPool';

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  static observers: MockIntersectionObserver[] = [];
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    MockIntersectionObserver.observers.push(this);
  }
  observe(_el: Element): void {}
  unobserve(_el: Element): void {}
  disconnect(): void {}
  trigger(entries: Array<{ target: Element; intersectionRatio: number }>): void {
    this.callback(
      entries.map((e) => ({
        target: e.target,
        intersectionRatio: e.intersectionRatio,
        isIntersecting: e.intersectionRatio > 0,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        time: 0,
      })),
      this as unknown as IntersectionObserver,
    );
  }
}

beforeEach(() => {
  MockIntersectionObserver.observers = [];
  (globalThis as unknown as { IntersectionObserver: typeof MockIntersectionObserver }).IntersectionObserver =
    MockIntersectionObserver;
});

describe('useViewportPlaybackPool', () => {
  it('returns empty Map initially', () => {
    const { result } = renderHook(() => useViewportPlaybackPool());
    expect(result.current.visibility.size).toBe(0);
  });

  it('updates visibility when IntersectionObserver fires', () => {
    const { result } = renderHook(() => useViewportPlaybackPool());
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');
    act(() => {
      result.current.register('a', el1);
      result.current.register('b', el2);
    });
    act(() => {
      MockIntersectionObserver.observers[0]?.trigger([
        { target: el1, intersectionRatio: 0.8 },
        { target: el2, intersectionRatio: 0.3 },
      ]);
    });
    expect(result.current.visibility.get('a')).toBe(0.8);
    expect(result.current.visibility.get('b')).toBe(0.3);
  });

  it('removes id from visibility on unregister', () => {
    const { result } = renderHook(() => useViewportPlaybackPool());
    const el = document.createElement('div');
    act(() => {
      result.current.register('a', el);
    });
    act(() => {
      MockIntersectionObserver.observers[0]?.trigger([
        { target: el, intersectionRatio: 0.5 },
      ]);
    });
    expect(result.current.visibility.get('a')).toBe(0.5);
    act(() => {
      result.current.unregister('a');
    });
    expect(result.current.visibility.has('a')).toBe(false);
  });
});
