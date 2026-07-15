import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TourMapModel } from '../../../lib/housing/buildTourMapPlacements';
import { applyWheelZoom, zoomAt, type MapView } from '../../../lib/housing/mapZoom';
import { computeDefaultView, routeBbox } from '../../../lib/housing/mapDefaultView';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';
import type { TourCrossing } from '../../../lib/housing/tourCrossing';
import { formatFullHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { canDisplayFullAddressWithReveal } from '../../../lib/housing/listingPublish';
import type { MockListing } from '../../../data/housing/mockListings';

export interface TourNavMapProps {
  status: 'none' | 'loading' | 'ready' | 'error';
  svg: string | null;
  viewBox: { w: number; h: number } | null;
  model: TourMapModel | null;
  /** 目的地(ステップ)の識別子。これが変わったら演出(ズームアウト→切替→ズームイン)を再生する。
   *  経路の形(route 文字列)ではなくステップそのもので判定する(アパルトメントは経路が無く
   *  連続すると route が同一になり、目的地変更を取りこぼすため)。 */
  stepKey: string | number;
  /** 起点エーテライトの名前。origin(座標)の上に常時ラベル表示する。無ければ非表示。 */
  originName?: string | null;
  /** 前の家→この家の移動種別。省略時は跨ぎ無し扱い。 */
  crossing?: TourCrossing;
  /** true の間、ステージにぼかし+跨ぎ案内カードを重ねる。省略時は出さない。 */
  showCrossing?: boolean;
  /** 「移動しました」ボタンの押下ハンドラ。省略時は no-op。 */
  onAckCrossing?: () => void;
  /** 現在の目的地の listing。左上のフル住所オーバーレイに使う。省略時はオーバーレイ自体を出さない。 */
  addressListing?: MockListing | null;
  /**
   * true=共有ツアーの参加者に住所を常時公開する(左上オーバーレイの既存 canDisplayFullAddress
   * ゲートを OR で上書き)。省略時(false)はホストの既存挙動を完全維持する。
   */
  revealAddress?: boolean;
}

const FIT_PAD_PX = 28;         // 既定表示で経路が端に貼り付かない余白（実画面ゲートで調整可）
const OVERVIEW_HOLD_MS = 350;  // 初回のみ: 全景を見せてからズームインを始めるまでの間
const OUT_MS = 550;            // ステップ変更: ズームアウト+フェードアウトの尺(この後に地図を差し替える)
const ZOOM_SETTLE_MS = 1000;   // ズームイン完了の保険(transitionend 不発時=全景と目標が同一等でも演出解除)
const OUT_FALLBACK_MS = 4000;  // 保険: dip開始からこの時間内に新地図が ready にならなければ旧地図を可視復帰し無限ブランクを防ぐ

/** バッファ表示する1枚の地図データ。loading 中も旧地図をこの形で保持し、スケルトンの「パッ」を消す。 */
type MapData = { svg: string; viewBox: { w: number; h: number }; model: TourMapModel | null };

/** ツアー中(Nav) 中央: 実エーテライト起点→家の経路をアニメし、目的地の実区画を光らせるナビ地図。
 * 目的地が変わると「ズームアウト→フェードで地図をシームレス切替→ズームイン」で着地。指/マウスでパン&ズーム可。 */
export const TourNavMap: React.FC<TourNavMapProps> = ({
  status, svg, viewBox, model, stepKey, originName,
  crossing = { kind: 'none' }, showCrossing = false, onAckCrossing = () => {},
  addressListing = null, revealAddress = false,
}) => {
  const { t, i18n } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<MapView>({ scale: 1, tx: 0, ty: 0 });
  const [wrapSize, setWrapSize] = useState<{ w: number; h: number } | null>(null);
  // バッファ表示中の地図(loading でも旧地図を出したままにしてポップを消す)。
  const [displayed, setDisplayed] = useState<MapData | null>(null);
  const [mapHidden, setMapHidden] = useState(false); // 演出のフェード(true=不可視)
  const [introAnim, setIntroAnim] = useState(false); // transform/opacity トランジション ON
  const [introBusy, setIntroBusy] = useState(false); // 演出中(origin ラベルを隠す)

  const displayedRef = useRef<MapData | null>(null);
  const wrapSizeRef = useRef<{ w: number; h: number } | null>(null);
  const latestReadyRef = useRef<(MapData & { key: string }) | null>(null); // 最新 ready の地図(差し替え元)
  const prevStepKey = useRef<string | null>(null);
  const pendingKeyRef = useRef<string | null>(null); // 差し替え待ちの目的地キー
  const outDoneRef = useRef(false);                   // ズームアウト完了フラグ
  const introActive = useRef(false);                  // 演出進行中(背景更新で殺さないためのガード)
  const zoomingIn = useRef(false);                    // true=ズームイン transition 中(out フェーズの transitionend で誤って終了させないためのガード)
  const introTimers = useRef<{ hold?: number; raf?: number; settle?: number; outFallback?: number }>({});
  const reduced = useReducedMotion();

  // 表示中の地図から overlay 用の派生値(すべて displayed 由来。props 直参照はしない=バッファのため)。
  const dm = displayed?.model ?? null;
  const dSvg = displayed?.svg ?? null;
  const dViewBox = displayed?.viewBox ?? null;
  const route = dm?.routePath ?? null;
  const routeJump = dm?.routeJumpPath ?? null;
  const origin = dm?.origin ?? null;
  const targetOutline = dm?.targetOutline ?? null;
  const hasDisplayed = displayed !== null;

  // wrap の実 px を観測(ResizeObserver)。ref も同期(コールバックから読むため)。wrap は常設なので一度だけ観測。
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) { const ws = { w: r.width, h: r.height }; wrapSizeRef.current = ws; setWrapSize(ws); }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // 指定の地図データ+wrap px から既定(フィット)ビューを計算する純関数。
  const computeTargetFor = useCallback((md: MapData | null, ws: { w: number; h: number } | null): MapView | null => {
    if (!md?.viewBox || !ws) return null;
    const m = md.model;
    const bbox = routeBbox([m?.routePath, m?.routeJumpPath], m?.origin ? [m.origin] : []);
    if (!bbox) return { scale: 1, tx: 0, ty: 0 };
    return computeDefaultView(bbox, md.viewBox, ws, FIT_PAD_PX);
  }, []);

  const clearIntroTimers = useCallback(() => {
    const tm = introTimers.current;
    if (tm.hold) { clearTimeout(tm.hold); tm.hold = undefined; }
    if (tm.raf) { cancelAnimationFrame(tm.raf); tm.raf = undefined; }
    if (tm.settle) { clearTimeout(tm.settle); tm.settle = undefined; }
    if (tm.outFallback) { clearTimeout(tm.outFallback); tm.outFallback = undefined; }
  }, []);

  // 演出の後始末(タイマー破棄 + フラグ/クラス解除 + フェード復帰)。完了・中断・手動リセットの共通処理。
  const endIntro = useCallback(() => {
    clearIntroTimers();
    introActive.current = false;
    zoomingIn.current = false;
    pendingKeyRef.current = null;
    outDoneRef.current = false;
    setIntroAnim(false);
    setIntroBusy(false);
    setMapHidden(false);
  }, [clearIntroTimers]);

  const setDisplayedBoth = useCallback((md: MapData | null) => {
    displayedRef.current = md;
    setDisplayed(md);
  }, []);

  // 差し替え条件(ズームアウト完了 && 新地図 ready && キー一致)が揃ったら、
  // 地図を差し替え→全景で固定(不可視)→次フレームでフェードイン+ズームイン。
  const tryDoSwap = useCallback(() => {
    const key = pendingKeyRef.current;
    if (!key || !outDoneRef.current) return;
    const ready = latestReadyRef.current;
    if (!ready || ready.key !== key) return; // 新地図がまだ ready でない
    pendingKeyRef.current = null;
    outDoneRef.current = false;
    const md: MapData = { svg: ready.svg, viewBox: ready.viewBox, model: ready.model };
    setDisplayedBoth(md);
    setView({ scale: 1, tx: 0, ty: 0 }); // 新地図を全景で(まだ不可視)
    const target = computeTargetFor(md, wrapSizeRef.current) ?? { scale: 1, tx: 0, ty: 0 };
    clearIntroTimers();
    introTimers.current.raf = requestAnimationFrame(() => {
      setMapHidden(false); // フェードイン
      zoomingIn.current = true; // ズームイン transition 開始(out フェーズの transitionend と区別するためのガード)
      setView(target);     // ズームイン(CSS transition)
      introTimers.current.settle = window.setTimeout(endIntro, ZOOM_SETTLE_MS);
    });
  }, [computeTargetFor, clearIntroTimers, endIntro, setDisplayedBoth]);

  // props(status/svg/model)が変わるたび: latestReady 更新 / 初回バッファ / アイドル背景更新 / 差し替え再開 / none・error 処理。
  useEffect(() => {
    if (status === 'ready' && svg && viewBox) {
      const key = String(stepKey);
      latestReadyRef.current = { svg, viewBox, model, key };
      if (!displayedRef.current) {
        setDisplayedBoth({ svg, viewBox, model }); // 初回表示(演出は下の step-change effect が hasDisplayed で拾う)
      } else if (!introActive.current && key === prevStepKey.current) {
        setDisplayedBoth({ svg, viewBox, model }); // アイドル中の背景更新(同一ステップの overlay 差し替え・アニメ無し)
      }
      tryDoSwap(); // 差し替え待ちなら実行
    } else if (status === 'none' || status === 'error') {
      // 現ステップに地図が無い/失敗: 演出を畳んでバッファをクリア→none/error 表示。
      endIntro();
      if (displayedRef.current) setDisplayedBoth(null);
    }
    // status === 'loading': 何もしない(旧地図を出したまま=ポップ回避)
  }, [status, svg, viewBox, model, stepKey, tryDoSwap, endIntro, setDisplayedBoth]);

  // 手動「デフォルト表示に戻す」= 即座に現在の地図へフィット(アニメなし)。演出中でも中断してスナップ。
  const resetView = useCallback(() => {
    const target = computeTargetFor(displayedRef.current, wrapSizeRef.current);
    if (!target) return;
    endIntro();
    setView(target);
  }, [computeTargetFor, endIntro]);

  // 目的地変更/初回で演出を駆動。deps に hasDisplayed を入れ、初回バッファ到着時にも再実行する
  // (背景更新=displayed の中身だけ変わるケースでは hasDisplayed 不変 → 再実行せず手動パンを保持)。
  // paint 前に全景を確定してチラつきを防ぐため useLayoutEffect。
  useLayoutEffect(() => {
    if (!wrapSize) return; // 計測待ち(揃ったら再実行)
    const key = String(stepKey);
    const firstReady = prevStepKey.current === null;
    const isStepChange = prevStepKey.current !== null && prevStepKey.current !== key;

    if (!firstReady && !isStepChange) {
      // 同一ステップの再描画(リサイズ等): 演出中でなければ現在の地図にフィット。
      if (!introActive.current && displayedRef.current) {
        const tgt = computeTargetFor(displayedRef.current, wrapSize);
        if (tgt) setView(tgt);
      }
      return;
    }
    if (firstReady && !displayedRef.current) return; // 初回は最初の地図が来るまで待つ(hasDisplayed で再実行)

    prevStepKey.current = key;

    if (reduced) {
      // reduced motion: 差し替え+スナップ(演出なし)
      endIntro();
      pendingKeyRef.current = key;
      outDoneRef.current = true;
      tryDoSwap();
      if (firstReady) {
        const tgt = computeTargetFor(displayedRef.current, wrapSize);
        if (tgt) setView(tgt);
      }
      return;
    }

    if (firstReady) {
      // 初回: 旧地図が無いのでズームアウト/フェード無し。全景→ホールド→ズームイン。
      clearIntroTimers();
      introActive.current = true;
      setIntroBusy(true);
      setIntroAnim(false);
      setMapHidden(false);
      setView({ scale: 1, tx: 0, ty: 0 });
      const target = computeTargetFor(displayedRef.current, wrapSize);
      introTimers.current.hold = window.setTimeout(() => {
        introTimers.current.raf = requestAnimationFrame(() => {
          setIntroAnim(true);
          zoomingIn.current = true; // ズームイン transition 開始
          if (target) setView(target);
        });
        introTimers.current.settle = window.setTimeout(endIntro, ZOOM_SETTLE_MS);
      }, OVERVIEW_HOLD_MS);
      return;
    }

    // isStepChange: dip = ズームアウト+フェードアウト → 新地図 ready で差し替え → ズームイン+フェードイン。
    clearIntroTimers();
    introActive.current = true;
    setIntroBusy(true);
    setIntroAnim(true);   // transform + opacity トランジション ON
    setMapHidden(true);   // フェードアウト
    zoomingIn.current = false; // out フェーズ(ズームアウト)開始。この transitionend では endIntro を呼ばない
    setView({ scale: 1, tx: 0, ty: 0 }); // ズームアウト(旧地図が全景へ)
    pendingKeyRef.current = key;
    outDoneRef.current = false;
    introTimers.current.hold = window.setTimeout(() => {
      outDoneRef.current = true;
      tryDoSwap(); // 新地図が既に ready なら差し替え+ズームイン、まだなら ready effect が後で呼ぶ
    }, OUT_MS);
    introTimers.current.outFallback = window.setTimeout(() => {
      // 保険: 新地図が長時間 ready にならない場合、無限ブランクを避けて旧地図を可視復帰させる
      // (endIntro が mapHidden を解除し、view は既に全景 {1,0,0} のまま=旧地図が全景で復帰する)。
      if (pendingKeyRef.current === key) endIntro();
    }, OUT_FALLBACK_MS);
  }, [stepKey, wrapSize, reduced, hasDisplayed, computeTargetFor, clearIntroTimers, endIntro, tryDoSwap]);

  // アンマウント時のみタイマー破棄(再実行では破棄しない=演出中のタイマーを守る)。
  useEffect(() => clearIntroTimers, [clearIntroTimers]);

  // ホイールズーム(カーソル位置固定)。React onWheel は passive で preventDefault が効かないためネイティブ登録。
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      endIntro(); // 演出中の操作は即中断(操作優先)
      const r = wrap.getBoundingClientRect();
      setView((v) => applyWheelZoom(v, e.clientX - r.left, e.clientY - r.top, e.deltaY));
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, [endIntro]);

  // パン(1本指/ドラッグ) + ピンチ(2本指)。pointer events で PC/タッチ統一。
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pan = useRef<{ sx: number; sy: number; tx0: number; ty0: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const localXY = (clientX: number, clientY: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    endIntro(); // 演出中の操作は即中断(操作優先)
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) {
      pan.current = { sx: e.clientX, sy: e.clientY, tx0: view.tx, ty0: view.ty };
      pinch.current = null;
    } else if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
      pan.current = null;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size >= 2 && pinch.current) {
      const [a, b] = [...ptrs.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = localXY((a.x + b.x) / 2, (a.y + b.y) / 2);
      const base = pinch.current;
      setView((v) => zoomAt(v, mid.x, mid.y, base.scale * (dist / base.dist)));
    } else if (pan.current) {
      const p = pan.current;
      setView((v) => ({ ...v, tx: p.tx0 + (e.clientX - p.sx), ty: p.ty0 + (e.clientY - p.sy) }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    if (ptrs.current.size === 1) {
      // ピンチ→単指: 残った指でパンを継続できるよう、その指の現在位置から pan を再初期化。
      const [rem] = [...ptrs.current.values()];
      pan.current = { sx: rem.x, sy: rem.y, tx0: view.tx, ty0: view.ty };
    }
    if (ptrs.current.size === 0) pan.current = null;
  };

  // 起点エーテライトのラベル位置。overlay(viewBox, xMidYMid meet)→wrap px のレターボックス写像に
  // zoom transform(translate→scale, origin 0,0)を重ねて画面座標へ投影。定サイズ HTML。演出/フェード中は隠す。
  const aetheryteLabel =
    !introBusy && !mapHidden && originName && origin && wrapSize && dViewBox
      ? (() => {
          const m = Math.min(wrapSize.w / dViewBox.w, wrapSize.h / dViewBox.h);
          const offX = (wrapSize.w - dViewBox.w * m) / 2;
          const offY = (wrapSize.h - dViewBox.h * m) / 2;
          return {
            x: (offX + origin.x * m) * view.scale + view.tx,
            y: (offY + origin.y * m) * view.scale + view.ty,
          };
        })()
      : null;

  const showSkeleton = status === 'loading' && !displayed;
  const showMessage = (status === 'none' || status === 'error') && !displayed;

  return (
    <div className="housing-tour-map" data-region="tour-map">
      <div className="housing-tour-map-stage">
        <div
          className="housing-tour-map-wrap is-nav"
          ref={wrapRef}
          onPointerDown={displayed ? onPointerDown : undefined}
          onPointerMove={displayed ? onPointerMove : undefined}
          onPointerUp={displayed ? onPointerUp : undefined}
          onPointerCancel={displayed ? onPointerUp : undefined}
        >
          {showSkeleton && <div className="housing-tour-map-skeleton" data-testid="tour-map-skeleton" aria-hidden="true" />}
          {showMessage && (
            <div className="housing-tour-map-none" data-testid="tour-map-none">
              <p className="housing-tour-map-none-text">{t(status === 'error' ? 'housing.tour.nav.map_error' : 'housing.tour.nav.map_none')}</p>
            </div>
          )}
          {displayed && dSvg && dViewBox && (
            <div
              className={`housing-map-zoom${introAnim ? ' is-intro' : ''}${mapHidden ? ' is-hidden' : ''}`}
              style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}
              onTransitionEnd={(e) => { if (e.propertyName === 'transform' && zoomingIn.current) endIntro(); }}
            >
              <div ref={hostRef} className="housing-map-svg-host" role="img" aria-label={t('housing.workspace.center.map_alt')} dangerouslySetInnerHTML={{ __html: dSvg }} />
              <svg className="housing-map-overlay" viewBox={`0 0 ${dViewBox.w} ${dViewBox.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                {targetOutline && (
                  <path
                    className="housing-tour-target-glow"
                    data-testid="tour-map-target-glow"
                    d={
                      targetOutline
                        .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${(x * dViewBox.w).toFixed(1)} ${(y * dViewBox.h).toFixed(1)}`)
                        .join(' ') + ' Z'
                    }
                  />
                )}
                {route && (
                  <>
                    <path className="housing-tour-route-glow" d={route} fill="none" />
                    <path data-testid="tour-map-route" className="housing-tour-route-core" d={route} fill="none">
                      <animate attributeName="stroke-dashoffset" from="0" to="-64" dur="1.1s" repeatCount="indefinite" />
                    </path>
                    <circle className="housing-tour-route-comet" r="10">
                      <animateMotion dur="2.2s" repeatCount="indefinite" path={route} rotate="auto" />
                    </circle>
                  </>
                )}
                {routeJump && (
                  <path data-testid="tour-map-route-jump" className="housing-tour-route-jump" d={routeJump} fill="none" />
                )}
                {origin && (
                  <g data-testid="tour-map-origin" className="housing-tour-map-origin-mark">
                    <circle className="housing-tour-map-origin-pulse" cx={origin.x} cy={origin.y} r="14">
                      <animate attributeName="r" from="14" to="30" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.9" to="0" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                    <circle className="housing-tour-map-origin-core" cx={origin.x} cy={origin.y} r="7" />
                  </g>
                )}
              </svg>
            </div>
          )}
          {aetheryteLabel && (
            <div
              className="housing-tour-map-aetheryte-label"
              style={{ left: `${aetheryteLabel.x}px`, top: `${aetheryteLabel.y}px` }}
              data-testid="tour-map-aetheryte-label"
            >
              {originName}
            </div>
          )}
        </div>
        {/* 左上フル住所オーバーレイ(共有ツアー同期): ホストは既定ゲート(showcase と一貫)、
            参加者は revealAddress で常時表示。表示のみ(地図操作を邪魔しないよう pointer-events:none)。 */}
        {addressListing && (
          <div className="housing-tour-map-address" data-testid="tour-map-address">
            {canDisplayFullAddressWithReveal(addressListing, revealAddress)
              ? formatFullHousingAddress(addressListing, i18n.language)
              : t('housing.card.addressPrivate')}
          </div>
        )}
        {displayed && (
          <div className="housing-hud is-top">
            <button type="button" data-testid="tour-map-reset" className="housing-tour-map-reset" onClick={resetView}>
              {t('housing.tour.nav.reset_view')}
            </button>
          </div>
        )}
        {displayed && (
          <div className="housing-tour-map-compass" data-testid="tour-map-compass" aria-hidden="true">
            <svg viewBox="0 0 40 40">
              <circle className="housing-tour-map-compass-ring" cx="20" cy="21" r="16" />
              <path className="housing-tour-map-compass-needle-n" d="M20 8 L24.5 22 L20 19 L15.5 22 Z" />
              <path className="housing-tour-map-compass-needle-s" d="M20 34 L15.5 22 L20 25 L24.5 22 Z" />
              <text className="housing-tour-map-compass-n" x="20" y="7">N</text>
            </svg>
          </div>
        )}
        {displayed && (
          <div className="housing-tour-map-hint" data-testid="tour-map-hint" aria-hidden="true">
            {t('housing.tour.nav.map_hint')}
          </div>
        )}
        {showCrossing && crossing.kind !== 'none' && (
          <div className="housing-tour-map-cross" data-testid="tour-map-cross">
            <div className="housing-tour-map-cross-card">
              <p className="housing-tour-map-cross-text">
                {crossing.kind === 'dc'
                  ? t('housing.tour.nav.cross.dc', { dc: crossing.dc, world: crossing.world })
                  : crossing.kind === 'world'
                    ? t('housing.tour.nav.cross.world', { world: crossing.world })
                    : t('housing.tour.nav.cross.region')}
              </p>
              <button type="button" className="housing-tour-map-cross-ack" onClick={onAckCrossing}>
                {t('housing.tour.nav.cross.ack')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
