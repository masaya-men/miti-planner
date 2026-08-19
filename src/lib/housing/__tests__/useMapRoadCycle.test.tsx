// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';

const mockJson: WardMapJson = {
  area: 'Test',
  viewBox: { w: 1000, h: 800 },
  nodes: [{ id: 'n', x: 0.5, y: 0.5 }],
  edges: [],
  houses: [],
  roadPath: 'M400 400L440 440M410 410L430 430',
  visibleRoadPath: null,
};

vi.mock('../../../data/housing/wardMapManifest', () => ({
  WARD_MAP_LOADERS: {
    testmap: async () => ({ json: mockJson, svg: '' }),
  },
}));

import { useMapRoadCycle, DRAWING_MS, HOLD_MS, FADE_MS } from '../useMapRoadCycle';

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useMapRoadCycle (2026-08-19 Allmarksまとめてインポート演出)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('マウント直後は loading、読み込み完了後は drawing になりスニペットを持つ', async () => {
    const { result } = renderHook(() => useMapRoadCycle());
    expect(result.current.phase).toBe('loading');
    await flushMicrotasks();
    expect(result.current.phase).toBe('drawing');
    expect(result.current.snippet?.d.length).toBeGreaterThan(0);
  });

  it('drawing→hold→fading→新周期(cycleId進行)の順に進む', async () => {
    const { result } = renderHook(() => useMapRoadCycle());
    await flushMicrotasks();
    const firstCycleId = result.current.cycleId;
    expect(result.current.phase).toBe('drawing');

    act(() => {
      vi.advanceTimersByTime(DRAWING_MS + 10);
    });
    expect(result.current.phase).toBe('hold');

    act(() => {
      vi.advanceTimersByTime(HOLD_MS + 10);
    });
    expect(result.current.phase).toBe('fading');

    act(() => {
      vi.advanceTimersByTime(FADE_MS + 10);
    });
    expect(result.current.cycleId).toBe(firstCycleId + 1);
    // 新周期はまず loading に戻り、読み込み完了後また drawing になる。
    await flushMicrotasks();
    expect(result.current.phase).toBe('drawing');
  });

  it('prefers-reduced-motion のときはタイマーを起動せず drawing のまま止まる', async () => {
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

    const { result } = renderHook(() => useMapRoadCycle());
    await flushMicrotasks();
    expect(result.current.reducedMotion).toBe(true);
    expect(result.current.phase).toBe('drawing');
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(result.current.phase).toBe('drawing');
    expect(result.current.cycleId).toBe(0);
  });

  it('アンマウントするとタイマーが解除される(残タイマー無し)', async () => {
    const { result, unmount } = renderHook(() => useMapRoadCycle());
    await flushMicrotasks();
    expect(result.current.phase).toBe('drawing');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
