// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMeasuredMemberLayout } from '../Timeline.layoutHooks';
import type { MemberRefEntry } from '../Timeline.layoutHooks';

vi.mock('../../lib/firebase', () => ({ db: {}, auth: {}, storage: {}, analytics: Promise.resolve(null), ensureAppCheck: () => null, getActiveAppCheck: () => null }));

describe('useMeasuredMemberLayout', () => {
  let mockRefs: Map<string, { offsetLeft: number; offsetWidth: number }>;
  let originalResizeObserver: typeof ResizeObserver | undefined;

  beforeEach(() => {
    mockRefs = new Map([
      ['MT', { offsetLeft: 570, offsetWidth: 125 }],
      ['H1', { offsetLeft: 695, offsetWidth: 125 }],
      ['D1', { offsetLeft: 820, offsetWidth: 50 }],
    ]);
    originalResizeObserver = (global as any).ResizeObserver;
  });

  afterEach(() => {
    (global as any).ResizeObserver = originalResizeObserver;
  });

  it('refs から left/width を読み Map に格納', () => {
    // entries を安定した参照で渡すことで useEffect の無限ループを防ぐ
    const entries: MemberRefEntry[] = [
      { id: 'MT', el: mockRefs.get('MT') as any },
      { id: 'H1', el: mockRefs.get('H1') as any },
      { id: 'D1', el: mockRefs.get('D1') as any },
    ];

    const { result } = renderHook(() =>
      useMeasuredMemberLayout(entries)
    );

    act(() => {});

    expect(result.current.get('MT')).toEqual({ left: 570, width: 125 });
    expect(result.current.get('H1')).toEqual({ left: 695, width: 125 });
    expect(result.current.get('D1')).toEqual({ left: 820, width: 50 });
  });

  it('ResizeObserver 発火で再計測', () => {
    const observers: ResizeObserverCallback[] = [];
    (global as any).ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) { observers.push(cb); }
      observe() {}
      disconnect() {}
    };

    // entries を安定した参照で渡すことで useEffect の無限ループを防ぐ
    const entries: MemberRefEntry[] = [{ id: 'MT', el: mockRefs.get('MT') as any }];

    const { result } = renderHook(() =>
      useMeasuredMemberLayout(entries)
    );

    (mockRefs.get('MT') as any).offsetWidth = 180;
    act(() => observers[0]?.([], {} as ResizeObserver));

    expect(result.current.get('MT')).toEqual({ left: 570, width: 180 });
  });
});
