// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { useWardMapAsset, type WardMapAssetState } from '../../lib/housing/useWardMapAsset';
import { installBrowseWardMapEnv, mockJson, renderMap } from './browseWardMapTestKit';

// useWardMapAsset をモックし、テストごとに ready/loading/error を切り替える (task-4-brief Step1)。
vi.mock('../../lib/housing/useWardMapAsset', () => ({
  useWardMapAsset: vi.fn(),
}));

installBrowseWardMapEnv();

// review 指摘 (Finding1): 地図をドラッグ中 (ポインタ down 中) はマーカーの hover 展開が発火しない
// ことを、BrowseWardMap → MapSpotCard の実配線 (gestureActiveRef) 込みで検証する
// (MapSpotCard.test.tsx 側は gestureActiveRef を直接操作する単体テスト、こちらは実際の
// pointerdown/up イベントから ref が正しく更新されることまで含めた結合テスト)。
// jsdom/happy-dom はブラウザのネイティブ pointer capture / retarget セマンティクスを再現しないため、
// あくまで「gestureActiveRef が正しく true/false に切り替わり、MapSpotCard がそれを尊重するか」の
// 検証であり、実機の再現性そのものは Playwright での実機再検証(t6-fix-visual/) で別途確認する。
describe('BrowseWardMap — hover 展開の暴走防止 (Finding1)', () => {
  const mockReady = () => {
    vi.mocked(useWardMapAsset).mockReturnValue({ status: 'ready', json: mockJson, svg: '<svg data-mock="1"></svg>' } as WardMapAssetState);
  };

  it('地図をドラッグ中 (pointerdown 中) にマーカーへ hover しても展開されない。ドラッグ終了後は通常通り展開する', () => {
    mockReady();
    vi.useFakeTimers();
    try {
      const onExpand = vi.fn();
      renderMap({ onExpand });
      const wrap = screen.getByTestId('bmap-wrap');
      const marker = screen.getByTestId('bmap-card-plot:5');

      // 空白部分 (マーカー外) で pointerdown = パン開始 → gestureActiveRef.current が true になる。
      fireEvent.pointerDown(wrap, { pointerId: 1, clientX: 10, clientY: 10 });
      fireEvent.mouseEnter(marker);
      vi.advanceTimersByTime(1000);
      expect(onExpand).not.toHaveBeenCalled();

      // ポインタを離す = ジェスチャー終了 → 通常の hover-intent 展開が復帰する。
      fireEvent.pointerUp(wrap, { pointerId: 1, clientX: 10, clientY: 10 });
      fireEvent.mouseEnter(marker);
      vi.advanceTimersByTime(1000);
      expect(onExpand).toHaveBeenCalledWith('plot:5');
    } finally {
      vi.useRealTimers();
    }
  });

  it('カード上で始まったドラッグ (pointerdown が marker-pos 内) でも、他マーカーへの hover 展開が抑止される', () => {
    mockReady();
    vi.useFakeTimers();
    try {
      const onExpand = vi.fn();
      renderMap({ onExpand });
      const marker5 = screen.getByTestId('bmap-card-plot:5');
      const markerApart = screen.getByTestId('bmap-card-apart:1');

      // マーカー自身の上で pointerdown (BrowseWardMap.tsx のマーカー除外分岐に入るが、
      // downPointerCount/gestureActiveRef の更新は除外より前に行われるため true になる)。
      fireEvent.pointerDown(marker5, { pointerId: 1, clientX: 0, clientY: 0 });
      fireEvent.mouseEnter(markerApart);
      vi.advanceTimersByTime(1000);
      expect(onExpand).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('カード起点ドラッグを wrap の外で離しても (pointerup が window にのみ届く)、hover 展開が復帰する', () => {
    // カード/マーカー起点の pointerdown は setPointerCapture されないため、wrap の外で
    // 離すと wrap は pointerup を受け取れない。減算を window リスナーに置いたことで
    // フラグが残留せず hover 展開が復帰することを検証する (BrowseWardMap.tsx の実装コメント参照)。
    mockReady();
    vi.useFakeTimers();
    try {
      const onExpand = vi.fn();
      renderMap({ onExpand });
      const marker5 = screen.getByTestId('bmap-card-plot:5');

      fireEvent.pointerDown(marker5, { pointerId: 1, clientX: 0, clientY: 0 });
      // wrap の外 (window 直接) で離す = wrap の onPointerUp が呼ばれないケースの模擬。
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 500, clientY: 500 });

      fireEvent.mouseEnter(marker5);
      vi.advanceTimersByTime(1000);
      expect(onExpand).toHaveBeenCalledWith('plot:5');
    } finally {
      vi.useRealTimers();
    }
  });
});

