// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import { useWardMapAsset, type WardMapAssetState } from '../../lib/housing/useWardMapAsset';
import { installBrowseWardMapEnv, mockJson, mkSpot, spots, renderMap } from './browseWardMapTestKit';

// useWardMapAsset をモックし、テストごとに ready/loading/error を切り替える (task-4-brief Step1)。
vi.mock('../../lib/housing/useWardMapAsset', () => ({
  useWardMapAsset: vi.fn(),
}));

installBrowseWardMapEnv();

describe('BrowseWardMap', () => {
  it('ready 時、spots 2件からマーカーが2個描画される', () => {
    vi.mocked(useWardMapAsset).mockReturnValue({ status: 'ready', json: mockJson, svg: '<svg data-mock="1"></svg>' } as WardMapAssetState);
    renderMap();
    expect(screen.getByTestId('bmap-card-plot:5')).toBeTruthy();
    expect(screen.getByTestId('bmap-card-apart:1')).toBeTruthy();
  });

  it('loading 時は静かな文言を表示し、マーカーは描画しない', () => {
    vi.mocked(useWardMapAsset).mockReturnValue({ status: 'loading' } as WardMapAssetState);
    renderMap();
    expect(screen.getByTestId('bmap-loading')).toBeTruthy();
    expect(screen.queryByTestId('bmap-card-plot:5')).toBeNull();
  });

  it('error 時は load_error 文言 + 一覧に戻るボタンを表示する', () => {
    vi.mocked(useWardMapAsset).mockReturnValue({ status: 'error' } as WardMapAssetState);
    renderMap();
    expect(screen.getByText('地図を読み込めませんでした')).toBeTruthy();
    const backBtn = screen.getByRole('button', { name: '一覧に戻る' });
    fireEvent.click(backBtn);
    expect(useHousingViewStore.getState().browseView).toBe('list');
  });

  it('地図の空白クリックで onExpand(null) が呼ばれる', () => {
    vi.mocked(useWardMapAsset).mockReturnValue({ status: 'ready', json: mockJson, svg: '<svg data-mock="1"></svg>' } as WardMapAssetState);
    const onExpand = vi.fn();
    renderMap({ onExpand });
    fireEvent.click(screen.getByTestId('bmap-wrap'));
    expect(onExpand).toHaveBeenCalledWith(null);
  });

  // 実機 Playwright 検証で発見したバグの回帰テスト: マウスで <button> を押すとブラウザ既定動作で
  // mousedown 直後にフォーカスが移り、MapSpotCard の onFocus(expandImmediately) がその場で展開する。
  // すると mouseup 時点でカーソル位置は展開カードの中身に変わっており、mousedown の target(マーカー)
  // と mouseup の target(展開カード内) が食い違うため、ブラウザは click イベントを両者の最近共通祖先
  // である `.housing-bmap-marker-pos` 上で発火する。この click は wrap までバブルしてくるが、
  // 「空白クリック」と誤認して onExpand(null) を呼んではいけない (呼ぶと「クリックで即展開」のはずが
  // 展開→即閉じる→hover-intent 遅延後に再展開、という目に見えるちらつきになる)。
  it('マーカー内(.housing-bmap-marker-pos)からバブルしてきたクリックは空白クリック扱いしない', () => {
    vi.mocked(useWardMapAsset).mockReturnValue({ status: 'ready', json: mockJson, svg: '<svg data-mock="1"></svg>' } as WardMapAssetState);
    const onExpand = vi.fn();
    // expandedKey は null のままでよい (この回帰は「展開中かどうか」ではなく
    // onBlankClick の target 判定そのものを検証するため。展開状態にすると ListingCard 経由で
    // react-router の Router 未提供エラーになり本題と無関係な依存が増えるので避ける)。
    renderMap({ onExpand });
    // マーカー自身 (.housing-bmap-marker-pos) は pointer-events:none で通常 click の target には
    // ならないが、フォーカス誘発の再ターゲットで実際に target になり得る (上記コメント参照)。
    // その状況を、marker-pos の直下要素上で click を発火させることで再現する。
    const markerPos = screen.getByTestId('bmap-card-plot:5').closest('.housing-bmap-marker-pos');
    expect(markerPos).toBeTruthy();
    fireEvent.click(markerPos as Element);
    expect(onExpand).not.toHaveBeenCalledWith(null);
  });

  it('マーカー外の本当の空白クリックは従来通り onExpand(null) を呼ぶ (上記回帰テストの対照)', () => {
    vi.mocked(useWardMapAsset).mockReturnValue({ status: 'ready', json: mockJson, svg: '<svg data-mock="1"></svg>' } as WardMapAssetState);
    const onExpand = vi.fn();
    renderMap({ onExpand });
    fireEvent.click(screen.getByTestId('bmap-stage'));
    expect(onExpand).toHaveBeenCalledWith(null);
  });

  it('座標が見つからないスポットはスキップし、クラッシュしない', () => {
    vi.mocked(useWardMapAsset).mockReturnValue({ status: 'ready', json: mockJson, svg: '<svg data-mock="1"></svg>' } as WardMapAssetState);
    const badSpot = mkSpot({ key: 'plot:99', kind: 'plot', plot: 99 });
    expect(() => renderMap({ spots: [...spots, badSpot] })).not.toThrow();
    expect(screen.queryByTestId('bmap-card-plot:99')).toBeNull();
  });
});
