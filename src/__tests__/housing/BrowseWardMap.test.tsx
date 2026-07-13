// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { BrowseWardMap } from '../../components/housing/browse/map/BrowseWardMap';
import { useWardMapAsset, type WardMapAssetState } from '../../lib/housing/useWardMapAsset';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import type { WardMapJson } from '../../data/housing/wardMapManifest';
import type { BrowseMapSpot } from '../../lib/housing/browseMapSpots';
import type { MockListing } from '../../data/housing/mockListings';

// useWardMapAsset をモックし、テストごとに ready/loading/error を切り替える (task-4-brief Step1)。
vi.mock('../../lib/housing/useWardMapAsset', () => ({
  useWardMapAsset: vi.fn(),
}));

// happy-dom が ResizeObserver を持たない場合に備えてポリフィル (LiquidGlassPanel.test.tsx 踏襲)。
beforeAll(() => {
  if (typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja',
      fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

// コンテナ rect のモック(ズーム/パン変換テスト用)。happy-dom はレイアウトを行わないため
// getBoundingClientRect は既定で全 0 を返す(既存テストはこれでも成立=フィット計算が早期 return するだけ)。
// ズーム/パン変換のテストではフィット計算(BrowseWardMap.tsx のコンテナ実寸 contain フィット)を
// 実際に走らせる必要があるため、全テスト共通で固定サイズの矩形を返すようにする。
let rectSpy: ReturnType<typeof vi.spyOn> | undefined;
const WRAP_RECT = { width: 300, height: 200, top: 0, left: 0, right: 300, bottom: 200, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

beforeEach(() => {
  useHousingViewStore.getState().reset();
  vi.mocked(useWardMapAsset).mockReset();
  rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(WRAP_RECT);
});

afterEach(() => {
  rectSpy?.mockRestore();
});

const mockJson: WardMapJson = {
  area: 'Mist',
  viewBox: { w: 100, h: 100 },
  nodes: [],
  edges: [],
  houses: [
    { kind: 'plot', plot: 5, x: 0.3, y: 0.4, node: null, outline: null },
    { kind: 'apart', plot: 1, x: 0.7, y: 0.2, node: null, outline: null },
  ],
  roadPath: '',
  visibleRoadPath: null,
};

let seq = 0;
function mkListing(over: Partial<MockListing> = {}): MockListing {
  seq += 1;
  return {
    id: `l-${seq}`,
    ownerUid: 'u1',
    dc: 'Mana',
    server: 'Anima',
    region: 'JP',
    area: 'Mist',
    ward: 3,
    buildingType: 'house',
    plot: 5,
    size: 'M',
    imageMode: 'none',
    tags: [],
    createdAt: 1000,
    lastConfirmedAt: 1000,
    addressKey: `k-${seq}`,
    ...over,
  };
}

function mkSpot(over: Partial<BrowseMapSpot>): BrowseMapSpot {
  const listing = mkListing();
  return {
    key: 'plot:5',
    kind: 'plot',
    plot: 5,
    listings: [listing],
    representative: listing,
    ...over,
  };
}

const spots: BrowseMapSpot[] = [
  mkSpot({ key: 'plot:5', kind: 'plot', plot: 5 }),
  mkSpot({ key: 'apart:1', kind: 'apart', plot: 1 }),
];

const renderMap = (props: Partial<React.ComponentProps<typeof BrowseWardMap>> = {}) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <BrowseWardMap
          mapKey="mist"
          spots={spots}
          expandedKey={null}
          onExpand={() => {}}
          onAddToTour={() => {}}
          onOpenPanel={() => {}}
          {...props}
        />
      </MemoryRouter>
    </I18nextProvider>,
  );

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
