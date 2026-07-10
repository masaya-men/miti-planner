// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useRipple } from '../useRipple';

// happy-dom は matchMedia 未実装のためポリフィル (useReducedMotion.test.tsx と同型)。
// matches は外側の可変変数を参照するクロージャにして、テストごとに reduced-motion を切り替える。
let matchMediaMatches = false;

beforeAll(() => {
  (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (
    query: string,
  ) =>
    ({
      matches: matchMediaMatches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
});

function makeClickEvent(clientX: number, clientY: number): ReactMouseEvent<HTMLElement> {
  return {
    currentTarget: {
      getBoundingClientRect: () => ({
        width: 100,
        height: 40,
        top: 0,
        left: 0,
        right: 100,
        bottom: 40,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    },
    clientX,
    clientY,
  } as unknown as ReactMouseEvent<HTMLElement>;
}

describe('useRipple', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    matchMediaMatches = false;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('クリックで ripple が 1 個追加される', () => {
    const { result } = renderHook(() => useRipple());
    expect(result.current.ripples).toHaveLength(0);
    act(() => {
      result.current.onClick(makeClickEvent(50, 20));
    });
    expect(result.current.ripples).toHaveLength(1);
  });

  it('650ms 経過で ripple が除去される', () => {
    const { result } = renderHook(() => useRipple());
    act(() => {
      result.current.onClick(makeClickEvent(50, 20));
    });
    expect(result.current.ripples).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(650);
    });
    expect(result.current.ripples).toHaveLength(0);
  });

  it('多連打しても個別 id で管理され、まとめて除去される', () => {
    const { result } = renderHook(() => useRipple());
    act(() => {
      result.current.onClick(makeClickEvent(10, 10));
      result.current.onClick(makeClickEvent(20, 20));
      result.current.onClick(makeClickEvent(30, 30));
    });
    expect(result.current.ripples).toHaveLength(3);
    const ids = result.current.ripples.map((r) => r.id);
    expect(new Set(ids).size).toBe(3);
    act(() => {
      vi.advanceTimersByTime(650);
    });
    expect(result.current.ripples).toHaveLength(0);
  });

  it('prefers-reduced-motion: reduce では ripple を生成しない', () => {
    matchMediaMatches = true;
    const { result } = renderHook(() => useRipple());
    act(() => {
      result.current.onClick(makeClickEvent(50, 20));
    });
    expect(result.current.ripples).toHaveLength(0);
  });

  it('アンマウント後にタイマーが残っても setState エラーにならない', () => {
    const { result, unmount } = renderHook(() => useRipple());
    act(() => {
      result.current.onClick(makeClickEvent(10, 10));
    });
    unmount();
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(650);
      });
    }).not.toThrow();
  });
});
