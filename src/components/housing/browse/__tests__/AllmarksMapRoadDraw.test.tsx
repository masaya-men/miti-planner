// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { WardMapJson } from '../../../../data/housing/wardMapManifest';

const mockJson: WardMapJson = {
  area: 'Test',
  viewBox: { w: 1000, h: 800 },
  nodes: [{ id: 'n', x: 0.5, y: 0.5 }],
  edges: [],
  houses: [],
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

  it('読み込み完了後は道の svg path を描画する', async () => {
    const { container } = render(<AllmarksMapRoadDraw />);
    await flushMicrotasks();
    const path = container.querySelector('.housing-allmarks-map-road-path');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('d')?.length ?? 0).toBeGreaterThan(0);
  });

  it('prefers-reduced-motion のときは描画アニメーションクラスを付けない', async () => {
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
    expect(container.querySelector('.housing-allmarks-map-road-path-drawing')).toBeNull();
    expect(container.querySelector('.housing-allmarks-map-road-fading')).toBeNull();
  });
});
