// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import '../../../../i18n';
import type { WardMapJson } from '../../../../data/housing/wardMapManifest';
import mistWardRaw from '../../../../data/housing/mistWard.generated.json';
import type { TourMapModel } from '../../../../lib/housing/buildTourMapPlacements';
import { TourNavMap } from '../TourNavMap';
const mistWard = mistWardRaw as unknown as WardMapJson;
const model: TourMapModel = { target: { x: 100, y: 100 }, placed: [ { index: 0, x: 100, y: 100, status: 'current' }, { index: 1, x: 200, y: 150, status: 'upcoming' } ], routePath: 'M10 10 L100 100', routeJumpPath: null, origin: { x: 10, y: 10 }, originName: null, targetElId: 'plot_6', targetOutline: null };

describe('TourNavMap', () => {
  it('ready で host/ゴージャス経路/起点マーカーを描く（番号ノード・LIVE・凡例は撤去済み）', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} stepKey={0} />);
    expect(container.querySelector('.housing-map-svg-host')).toBeTruthy();
    expect(container.querySelector('[data-testid="tour-map-route"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="tour-map-origin"]')).toBeTruthy();
    // 改善4: 地図上の番号マーカー(①②③/✓)は撤去
    expect(container.querySelectorAll('[data-testid="tour-map-node"]').length).toBe(0);
    // 改善6: LIVEピルと凡例は撤去
    expect(container.querySelector('.housing-tour-map-live')).toBeNull();
    expect(container.querySelector('.housing-tour-map-legend')).toBeNull();
  });
  it('目的地の放射リング(波紋)は撤去済み: r アニメ from="60" が存在しない', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} stepKey={0} />);
    // 波紋 circle は r: 60→170 のアニメが目印(origin脈動は r: 14→30 で別物)
    expect(container.querySelectorAll('animate[attributeName="r"][from="60"]').length).toBe(0);
    // 波紋を包んでいた aria-hidden の <g> ラッパーごと消えていること
    expect(container.querySelectorAll('.housing-map-overlay > g[aria-hidden="true"]').length).toBe(0);
  });
  it('エーテライトの脈動(origin)は波紋撤去後も残る', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} stepKey={0} />);
    const originGroup = container.querySelector('[data-testid="tour-map-origin"]');
    expect(originGroup).not.toBeNull();
    expect(originGroup?.querySelector('animate[attributeName="r"][from="14"]')).not.toBeNull();
  });
  it('被せ矩形は撤去 (overlay に rect が無い)', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} stepKey={0} />);
    expect(container.querySelectorAll('.housing-map-overlay rect').length).toBe(0);
  });
  it('targetOutline があれば overlay に honey 発光パス(実輪郭)を描く', () => {
    const gm: TourMapModel = { ...model, targetOutline: [[0.5, 0.4], [0.6, 0.4], [0.6, 0.5], [0.5, 0.5]] };
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={gm} stepKey={0} />);
    const glow = container.querySelector('[data-testid="tour-map-target-glow"]');
    expect(glow).toBeTruthy();
    expect(glow?.getAttribute('d')?.startsWith('M')).toBe(true);
    expect(glow?.getAttribute('d')?.endsWith('Z')).toBe(true);
  });
  it('targetOutline が null なら発光パスは描かない', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} stepKey={0} />);
    expect(container.querySelector('[data-testid="tour-map-target-glow"]')).toBeNull();
  });
  it('routeJumpPath があれば破線ジャンプを描く', () => {
    const jm: TourMapModel = { ...model, routeJumpPath: 'M100 100 L140 160' };
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={jm} stepKey={0} />);
    const jump = container.querySelector('[data-testid="tour-map-route-jump"]');
    expect(jump).toBeTruthy();
    expect(jump?.getAttribute('d')).toBe('M100 100 L140 160');
  });
  it('routeJumpPath が null なら破線ジャンプは描かない', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} stepKey={0} />);
    expect(container.querySelector('[data-testid="tour-map-route-jump"]')).toBeNull();
  });
  it('none はプレースホルダ・loading はスケルトン', () => {
    const none = render(<TourNavMap status="none" svg={null} viewBox={null} model={null} stepKey={0} />);
    expect(none.container.querySelector('[data-testid="tour-map-none"]')).toBeTruthy();
    const load = render(<TourNavMap status="loading" svg={null} viewBox={null} model={null} stepKey={0} />);
    expect(load.container.querySelector('[data-testid="tour-map-skeleton"]')).toBeTruthy();
  });
  it('ready でパン/ズーム用の .housing-map-zoom と「全体に戻す」ボタンを持つ', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} stepKey={0} />);
    expect(container.querySelector('.housing-map-zoom')).toBeTruthy();
    expect(container.querySelector('[data-testid="tour-map-reset"]')).toBeTruthy();
  });
  it('showCrossing=true + dc で案内カードが出る(ボタンは持たない)', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} stepKey={0}
      crossing={{ kind: 'dc', dc: 'Gaia', world: 'Ifrit' }} showCrossing={true} />);
    expect(container.querySelector('[data-testid="tour-map-cross"]')).toBeTruthy();
    // ユーザー指示: 「地図を見る」ボタンは撤去済み。ack への到達手段は呼び出し側の「次へ」に一本化。
    expect(container.querySelector('.housing-tour-map-cross-ack')).toBeNull();
  });
  it('showCrossing=false では出ない', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} stepKey={0}
      crossing={{ kind: 'dc', dc: 'Gaia', world: 'Ifrit' }} showCrossing={false} />);
    expect(container.querySelector('[data-testid="tour-map-cross"]')).toBeNull();
  });
  it('crossingReadOnly=true では待機文言を出す(ボタン無し)', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} stepKey={0}
      crossing={{ kind: 'dc', dc: 'Gaia', world: 'Ifrit' }} showCrossing={true} crossingReadOnly />);
    expect(container.querySelector('.housing-tour-map-cross-waiting')).toBeTruthy();
    expect(container.querySelector('.housing-tour-map-cross-ack')).toBeNull();
  });
  it('viewingTimerText を渡すと見学中タイマーチップを描く', () => {
    const { container, rerender } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} stepKey={0} viewingTimerText={null} />);
    expect(container.querySelector('[data-testid="tour-mobile-viewing-timer"]')).toBeNull();
    rerender(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} stepKey={0} viewingTimerText="3:24 経過" />);
    const chip = container.querySelector('[data-testid="tour-mobile-viewing-timer"]');
    expect(chip).toBeTruthy();
    expect(chip?.textContent).toBe('3:24 経過');
  });
  it('2本指ピンチ後に1本指を離すと、残った指でパンが継続する', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} stepKey={0} />);
    const wrap = container.querySelector('.housing-tour-map-wrap') as HTMLElement;
    const zoom = container.querySelector('.housing-map-zoom') as HTMLElement;
    // happy-dom はレイアウト無し=RO 未発火なので既定 view は初期値 translate(0px,0px) scale(1)。
    fireEvent.pointerDown(wrap, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(wrap, { pointerId: 2, clientX: 200, clientY: 100 }); // 2本指=ピンチ開始(pan は null 化)
    fireEvent.pointerUp(wrap, { pointerId: 2, clientX: 200, clientY: 100 });   // 片指を離す→残指で pan 再初期化されるべき
    fireEvent.pointerMove(wrap, { pointerId: 1, clientX: 150, clientY: 100 }); // 残指を +50px 移動
    // 修正前は pan が凍結し translate(0px,0px) のまま。修正後は tx が動く。
    expect(zoom.style.transform).not.toBe('translate(0px, 0px) scale(1)');
  });
});

// ⑧ マップ切替×ズーム衝突の根治(zoomingIn ガード + 保険タイムアウト)。
// happy-dom は実際の CSS transition を走らせないため、旧地図のズームアウト transitionend を
// 手動 dispatch して「out フェーズの transitionend では endIntro を呼ばない」ガードをロジック単体で検証する。
describe('TourNavMap — ⑧ ズーム衝突根治 (zoomingIn ガード + 保険タイムアウト)', () => {
  let roCallback: ResizeObserverCallback | null = null;
  let origRO: unknown;

  beforeEach(() => {
    vi.useFakeTimers();
    roCallback = null;
    origRO = (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) { roCallback = cb; }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = origRO;
  });

  // happy-dom の TransitionEvent は Event の別名で、コンストラクタが init から propertyName を
  // 拾わない(happy-dom/lib/event/Event.js は bubbles/cancelable/composed のみ読む)。
  // React の SyntheticTransitionEvent は nativeEvent.propertyName をそのまま読むため、
  // インスタンスに直接生やしてから dispatch すれば onTransitionEnd={(e) => e.propertyName} に正しく伝わる。
  const fireTransformTransitionEnd = (el: HTMLElement) => {
    const evt = new Event('transitionend', { bubbles: true, cancelable: true });
    (evt as unknown as { propertyName: string }).propertyName = 'transform';
    act(() => { el.dispatchEvent(evt); });
  };

  const fireResize = () => {
    act(() => {
      roCallback?.(
        [{ contentRect: { width: 800, height: 600 } } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });
  };

  const svgA = '<svg><path id="plot_6" /></svg>';
  const svgB = '<svg><path id="plot_7" /></svg>';
  const vb = { w: mistWard.viewBox.w, h: mistWard.viewBox.h };

  it('初回ズームイン完了: ズームイン中(zoomingIn=true)の transform transitionend では従来どおり演出が終了する', () => {
    const { container } = render(
      <TourNavMap status="ready" svg={svgA} viewBox={vb} model={model} stepKey={0} />,
    );
    fireResize();
    act(() => { vi.advanceTimersByTime(500); }); // OVERVIEW_HOLD_MS(350) 経過 + rAF 1 フレーム

    const zoomEl = container.querySelector('.housing-map-zoom') as HTMLElement;
    expect(zoomEl.className).toContain('is-intro'); // ズームイン transition 中

    fireTransformTransitionEnd(zoomEl);
    expect(zoomEl.className).not.toContain('is-intro'); // endIntro が呼ばれ演出終了(従来どおり)
  });

  it('目的地変更(dip)中: 旧地図のズームアウト transitionend が来ても演出を破棄しない(is-hidden を維持) = ⑧の回帰テスト本体', () => {
    const { container, rerender } = render(
      <TourNavMap status="ready" svg={svgA} viewBox={vb} model={model} stepKey={0} />,
    );
    fireResize();
    act(() => { vi.advanceTimersByTime(500); }); // 初回ズームインを終える

    // 目的地変更: 新地図はまだ ready でない(loading = 非同期ロード中を模す)。
    rerender(<TourNavMap status="loading" svg={null} viewBox={null} model={null} stepKey={1} />);
    const zoomEl = container.querySelector('.housing-map-zoom') as HTMLElement;
    expect(zoomEl.className).toContain('is-hidden'); // dip 開始でフェードアウト

    // JS 側 OUT_MS(550ms)は経過するが新地図はまだ来ない。
    act(() => { vi.advanceTimersByTime(600); });
    expect(zoomEl.className).toContain('is-hidden'); // まだ待機中

    // 旧地図のズームアウト CSS transition(実測は OUT_MS より長い=根因)が遅れて完了した想定。
    fireTransformTransitionEnd(zoomEl);

    // 根治前: onTransitionEnd が無条件に endIntro() を呼び is-hidden が解除されていた
    // (待機状態が壊れ、後で新地図がアニメ無しでパッと出る=「ズームが起きない」バグの引き金)。
    // 根治後: zoomingIn=false (out フェーズ) のガードにより endIntro は呼ばれず、待機状態が保たれる。
    expect(zoomEl.className).toContain('is-hidden');
  });

  it('out フェーズの誤 transitionend の後でも、新地図が ready になれば is-intro を維持したまま正しくズームインする', () => {
    const { container, rerender } = render(
      <TourNavMap status="ready" svg={svgA} viewBox={vb} model={model} stepKey={0} />,
    );
    fireResize();
    act(() => { vi.advanceTimersByTime(500); });

    rerender(<TourNavMap status="loading" svg={null} viewBox={null} model={null} stepKey={1} />);
    act(() => { vi.advanceTimersByTime(600); }); // OUT_MS 経過(新地図はまだ ready でない)

    const zoomEl = container.querySelector('.housing-map-zoom') as HTMLElement;
    fireTransformTransitionEnd(zoomEl); // out フェーズの誤 transitionend

    // 新地図がようやく ready になる。
    rerender(<TourNavMap status="ready" svg={svgB} viewBox={vb} model={model} stepKey={1} />);
    act(() => { vi.advanceTimersByTime(50); }); // 差し替え直後の rAF フレーム

    const zoomEl2 = container.querySelector('.housing-map-zoom') as HTMLElement;
    expect(zoomEl2.className).toContain('is-intro'); // ズームイン transition が維持されたまま
    expect(zoomEl2.className).not.toContain('is-hidden'); // フェードインして可視化
    expect(container.querySelector('#plot_7')).toBeTruthy(); // 新地図の内容に差し替わっている
  });

  it('保険: 新地図が長時間 ready にならない場合、保険タイムアウト経過で旧地図を可視復帰させる(無限ブランク回避)', () => {
    const { container, rerender } = render(
      <TourNavMap status="ready" svg={svgA} viewBox={vb} model={model} stepKey={0} />,
    );
    fireResize();
    act(() => { vi.advanceTimersByTime(500); });

    rerender(<TourNavMap status="loading" svg={null} viewBox={null} model={null} stepKey={1} />);
    const zoomEl = container.querySelector('.housing-map-zoom') as HTMLElement;
    expect(zoomEl.className).toContain('is-hidden');

    // 新地図が一切来ないまま保険タイムアウト(OUT_FALLBACK_MS=4000ms)を超過。
    act(() => { vi.advanceTimersByTime(4300); });

    const zoomElAfter = container.querySelector('.housing-map-zoom') as HTMLElement;
    expect(zoomElAfter.className).not.toContain('is-hidden'); // 旧地図(plot_6)が可視復帰
    expect(container.querySelector('#plot_6')).toBeTruthy(); // 表示中の地図はまだ旧データのまま(無限ブランクにならない)
  });
});
