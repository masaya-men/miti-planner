// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { WardMapJson } from '../../../../data/housing/wardMapManifest';

const mockJson: WardMapJson = {
  area: 'Test',
  viewBox: { w: 1000, h: 800 },
  nodes: [{ id: 'n', x: 0.5, y: 0.5 }],
  edges: [],
  houses: [
    { kind: 'plot', plot: 1, x: 0.4, y: 0.4, node: 'n', outline: [[0.39, 0.39], [0.41, 0.39], [0.41, 0.41], [0.39, 0.41]] },
  ],
  roadPath: 'M400 400L440 440M410 410L430 430',
  visibleRoadPath: null,
};

vi.mock('../../../../data/housing/wardMapManifest', () => ({
  WARD_MAP_LOADERS: {
    testmap: async () => ({ json: mockJson, svg: '' }),
  },
}));

import { AllmarksMapRoadDraw } from '../AllmarksMapRoadDraw';

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('AllmarksMapRoadDraw (2026-08-19 Allmarksまとめてインポート演出)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('読み込み前は空のプレースホルダーを描画する', async () => {
    const { container } = render(<AllmarksMapRoadDraw />);
    expect(container.querySelector('.housing-allmarks-map-road-path')).toBeNull();
    // マップ読み込み(モック済み非同期)をこのテストの act() 内で解決しておく
    // (未解決のままだと後続テストへ act() 外の state 更新が漏れる)。
    await flushMicrotasks();
  });

  it('読み込み完了後は道の svg path と家の区画の polygon を描画する', async () => {
    const { container } = render(<AllmarksMapRoadDraw />);
    await flushMicrotasks();
    const path = container.querySelector('.housing-allmarks-map-road-path');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('d')?.length ?? 0).toBeGreaterThan(0);
    const house = container.querySelector('.housing-allmarks-map-road-house');
    expect(house).not.toBeNull();
    expect(house?.getAttribute('points')?.length ?? 0).toBeGreaterThan(0);
  });

  it('drawing フェーズ中は道・家ともに stroke-dasharray を実寸ぶん適用する(描かれる演出)', async () => {
    const { container } = render(<AllmarksMapRoadDraw />);
    await flushMicrotasks();
    const path = container.querySelector('.housing-allmarks-map-road-path') as SVGPathElement;
    const house = container.querySelector('.housing-allmarks-map-road-house') as SVGPolygonElement;
    // measuring → drawing への切替 (requestAnimationFrame) を進める。
    await flushMicrotasks();
    expect(path.style.strokeDasharray).not.toBe('');
    expect(house.style.strokeDasharray).not.toBe('');
  });

  it('prefers-reduced-motion のときは dasharray を付けず通常のストロークで静止表示する', async () => {
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

    const { container } = render(<AllmarksMapRoadDraw />);
    await flushMicrotasks();
    const path = container.querySelector('.housing-allmarks-map-road-path') as SVGPathElement;
    expect(path.style.strokeDasharray).toBe('');
    expect(container.querySelector('.housing-allmarks-map-road-fading')).toBeNull();
  });
});
