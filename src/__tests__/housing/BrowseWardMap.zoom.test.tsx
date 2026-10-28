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

// レビュー指摘(Task4): ズーム/パン/クランプ変換にテストが皆無だったための追加分。
// コンテナは WRAP_RECT(300x200)固定、mockJson.viewBox は 100x100 のため、
// contain フィットは scale=min(300/100, 200/100)=2 (=fitScale)、tx=(300-100*2)/2=50、ty=(200-100*2)/2=0 で確定する
// (BrowseWardMap.tsx のコメント通り、view.scale は「フィット基準の倍率(レベル)」で保持され、
// 実際の描画倍率は fitScale*view.scale。stage の transform 文字列からこれを読み取って検証する)。
describe('BrowseWardMap ズーム/パン/クランプ変換', () => {
  const FIT_SCALE = 2;
  const FIT_TX = 50;
  const FIT_TY = 0;
  // BrowseWardMap.tsx 冒頭の MAX_ZOOM_LEVEL(=6, フィット基準の手動ズーム上限)をテスト側にも固定値として持つ。
  const MAX_ZOOM_LEVEL = 6;

  const mockReady = () => {
    vi.mocked(useWardMapAsset).mockReturnValue({ status: 'ready', json: mockJson, svg: '<svg data-mock="1"></svg>' } as WardMapAssetState);
  };

  const readStageTransform = (): { tx: number; ty: number; scale: number } => {
    const stage = screen.getByTestId('bmap-stage');
    const m = stage.style.transform.match(/^translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)$/);
    if (!m) throw new Error(`想定外の transform 形式: ${stage.style.transform}`);
    return { tx: Number(m[1]), ty: Number(m[2]), scale: Number(m[3]) };
  };

  // happy-dom の WheelEvent は UIEvent を直接継承しており(本来の spec は MouseEvent 継承)、
  // clientX/clientY を実装していない。fireEvent.wheel(el, { clientX, clientY }) は
  // コンストラクタが読まないプロパティを渡すだけで握りつぶされ、e.clientX が undefined になり
  // 実装側の mx/my(ひいては tx/ty)が NaN 化することを実機確認済み。ネイティブ WheelEvent を組み立てた後
  // defineProperty で直接値を差し込んで dispatch する。
  const fireWheelAt = (el: HTMLElement, clientX: number, clientY: number, deltaY: number) => {
    const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clientX', { value: clientX, configurable: true });
    Object.defineProperty(event, 'clientY', { value: clientY, configurable: true });
    fireEvent(el, event);
  };

  // mapZoom.zoomAt の式をテスト側で独立に再現する (import して比較すると「実装が実装通り動く」だけの
  // トートロジーになるため、mapZoom.ts 記載の式をそのまま書き写して期待値を計算する)。
  // レベル空間(フィット基準倍率)で計算し、呼び出し側で fitScale を掛けて実 px と比較する。
  const expectedZoomAtLevel = (
    v: { scale: number; tx: number; ty: number },
    mx: number,
    my: number,
    nextScaleRaw: number,
  ): { scale: number; tx: number; ty: number } => {
    const MIN_SCALE = 1;
    const MAX_SCALE = 8;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScaleRaw));
    if (newScale === v.scale) return v;
    const k = newScale / v.scale;
    return { scale: newScale, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k };
  };

  it('フィット直後の初期表示は contain フィット値と一致する', () => {
    mockReady();
    renderMap();
    const t = readStageTransform();
    expect(t).toEqual({ tx: FIT_TX, ty: FIT_TY, scale: FIT_SCALE });
  });

  it('wheel でズームインすると、カーソル位置(アンカー点)を固定した変換になる', () => {
    mockReady();
    renderMap();
    const wrap = screen.getByTestId('bmap-wrap');
    const before = readStageTransform();
    expect(before).toEqual({ tx: FIT_TX, ty: FIT_TY, scale: FIT_SCALE });

    const mx = 100;
    const my = 50;
    fireWheelAt(wrap, mx, my, -100); // deltaY<0 = ズームイン

    const after = readStageTransform();
    // レベル空間(scale=1が初期フィット)での期待値。STEP=1.1 は mapZoom.ts のホイール1step分の倍率。
    const expectedLevel = expectedZoomAtLevel({ scale: 1, tx: FIT_TX, ty: FIT_TY }, mx, my, 1 * 1.1);
    expect(after.scale).toBeCloseTo(expectedLevel.scale * FIT_SCALE, 9);
    expect(after.tx).toBeCloseTo(expectedLevel.tx, 9);
    expect(after.ty).toBeCloseTo(expectedLevel.ty, 9);
    expect(after).not.toEqual(before); // 変化していること自体も確認
  });

  it('wheel ズームインを繰り返しても ×6(フィット基準)相当を超えない', () => {
    mockReady();
    renderMap();
    const wrap = screen.getByTestId('bmap-wrap');
    for (let i = 0; i < 30; i++) {
      fireWheelAt(wrap, 100, 50, -100);
    }
    const { scale } = readStageTransform();
    expect(scale).toBeCloseTo(MAX_ZOOM_LEVEL * FIT_SCALE, 9);
  });

  it('wheel ズームアウトを繰り返してもフィット(レベル1)を下回らない', () => {
    mockReady();
    renderMap();
    const wrap = screen.getByTestId('bmap-wrap');
    const before = readStageTransform();
    for (let i = 0; i < 10; i++) {
      fireWheelAt(wrap, 100, 50, 100); // deltaY>0 = ズームアウト
    }
    const after = readStageTransform();
    expect(after).toEqual(before); // フィット(scale=fitScale)のまま変化しない
  });

  it('pointer ドラッグでパンすると、移動量ぶん tx/ty が変化する(scale は不変)', () => {
    mockReady();
    renderMap();
    const wrap = screen.getByTestId('bmap-wrap');
    const before = readStageTransform();

    fireEvent.pointerDown(wrap, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(wrap, { pointerId: 1, clientX: 140, clientY: 130 }); // dx=40, dy=30 (クリック閾値4pxを超える)
    fireEvent.pointerUp(wrap, { pointerId: 1, clientX: 140, clientY: 130 });

    const after = readStageTransform();
    expect(after.tx).toBeCloseTo(before.tx + 40, 9);
    expect(after.ty).toBeCloseTo(before.ty + 30, 9);
    expect(after.scale).toBeCloseTo(before.scale, 9);
  });

  // review 指摘(Task4): カサカサ根治の核心配線に自動テストが無かったための追加分。
  // .housing-bmap-card-plane は .housing-bmap-stage と同一 transform 文字列を持つことで、
  // カード群が地図(SVG)と全く同じズレなく追従する(=カサカサの原因だった「毎フレーム再計算した
  // 画面座標に微妙な誤差が乗る」構造を廃止した設計そのもの)。plane が別スケール/別tx-tyを
  // 使うようになる回帰をここで検知する。
  it('.housing-bmap-card-plane と .housing-bmap-stage の transform は常に一致する(plane が別スケールを使う回帰を検知)', () => {
    mockReady();
    renderMap();
    const stage = screen.getByTestId('bmap-stage');
    const plane = screen.getByTestId('bmap-card-plane');
    expect(plane.style.transform).toBe(stage.style.transform);

    const wrap = screen.getByTestId('bmap-wrap');
    fireWheelAt(wrap, 100, 50, -100); // ズームイン後も一致し続けること

    expect(plane.style.transform).toBe(stage.style.transform);
  });

  // .housing-bmap-marker-pos(各カードの親)は区画座標 translate(m.x, m.y) で置かれ、
  // view(pan/zoom) に依存しない(旧 sx/sy 画面座標の per-frame 再計算をやめたのがカサカサ根治の
  // 本質)。stage の transform は変化するのに marker-pos の transform は不変であることを確認する。
  it('.housing-bmap-marker-pos の transform は区画座標固定で view(pan/zoom) に依存しない', () => {
    mockReady();
    renderMap();
    const wrap = screen.getByTestId('bmap-wrap');
    const stage = screen.getByTestId('bmap-stage');
    const markerPos = screen.getByTestId('bmap-card-plot:5').closest('.housing-bmap-marker-pos') as HTMLElement;
    expect(markerPos).toBeTruthy();

    const markerTransformBefore = markerPos.style.transform;
    const stageTransformBefore = stage.style.transform;
    expect(markerTransformBefore).toMatch(/^translate\([-\d.]+px, [-\d.]+px\)$/);

    fireEvent.pointerDown(wrap, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(wrap, { pointerId: 1, clientX: 140, clientY: 130 }); // dx=40, dy=30
    fireEvent.pointerUp(wrap, { pointerId: 1, clientX: 140, clientY: 130 });

    expect(stage.style.transform).not.toBe(stageTransformBefore); // stage(地図)は動く
    expect(markerPos.style.transform).toBe(markerTransformBefore); // marker-pos(区画座標)は不変
  });
});
