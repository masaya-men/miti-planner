import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TourMapModel } from '../../../lib/housing/buildTourMapPlacements';
import { applyWheelZoom, zoomAt, type MapView } from '../../../lib/housing/mapZoom';
import { computeDefaultView, routeBbox } from '../../../lib/housing/mapDefaultView';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';

export interface TourNavMapProps {
  status: 'none' | 'loading' | 'ready' | 'error';
  svg: string | null;
  viewBox: { w: number; h: number } | null;
  model: TourMapModel | null;
  /** 目的地(ステップ)の識別子。これが変わったら「全景→ズームイン」を再生する。
   *  経路の形(route 文字列)ではなくステップそのもので判定する(アパルトメントは経路が無く
   *  連続すると route が同一になり、目的地変更を取りこぼすため)。 */
  stepKey: string | number;
  /** 起点エーテライトの名前。origin(座標)の上に常時ラベル表示する。無ければ非表示。 */
  originName?: string | null;
}

const FIT_PAD_PX = 28; // 既定表示で経路が端に貼り付かない余白（実画面ゲートで調整可）
const OVERVIEW_HOLD_MS = 350; // 目的地変更時、全景を見せてからズームインを始めるまでの間（実画面ゲートで調整可）
const ZOOM_SETTLE_MS = 1000;  // ズームイン完了の保険（transitionend 不発時=全景と目標が同一等でも演出状態を確実に解除）

/** ツアー中(Nav) 中央: 実エーテライト起点→家の経路をアニメし、目的地の実区画(#plot_N/#apart_N)を光らせるナビ地図。
 * 地図は指/マウスでパン&ズーム可。既定は起点〜家の経路にフィット（見切れ厳禁）、ステップが変わると自動で既定へ戻る。 */
export const TourNavMap: React.FC<TourNavMapProps> = ({ status, svg, viewBox, model, stepKey, originName }) => {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const route = model?.routePath ?? null;
  const routeJump = model?.routeJumpPath ?? null;
  const origin = model?.origin ?? null;
  const targetOutline = model?.targetOutline ?? null;

  const [view, setView] = useState<MapView>({ scale: 1, tx: 0, ty: 0 });
  const [wrapSize, setWrapSize] = useState<{ w: number; h: number } | null>(null);
  // 目的地変更時の「全景→ズームイン」演出中フラグ(CSS transition ON)。手動操作・リサイズでは false。
  const [introAnim, setIntroAnim] = useState(false);
  // 演出(ホールド+ズーム)進行中は origin ラベルを隠す(演出中は view が目標へ飛びラベルがズレるため)。
  const [introBusy, setIntroBusy] = useState(false);
  const prevStepKey = useRef<string | null>(null);
  const introActive = useRef(false); // 演出(全景→ズーム)進行中。非ステップ変更(リサイズ等)で演出を殺さないためのガード。
  const introTimers = useRef<{ hold?: number; raf?: number; settle?: number }>({});
  const reduced = useReducedMotion();

  // wrap の実 px を観測（forced reflow 回避のため ResizeObserver）。
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setWrapSize({ w: r.width, h: r.height });
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [status]);

  // 目標(既定)ビュー = 起点〜家の経路にフィット。手動リセットとステップ着地の両方で使う純計算。
  // deps は origin オブジェクトでなく座標プリミティブで比較。mapModel 再生成で origin 参照だけ変わる
  // 背景更新ではリセットを起こさず、実ステップ変更(route 文字列が必ず変わる)時のみ動く。
  const computeTarget = useCallback((): MapView | null => {
    if (!viewBox || !wrapSize) return null;
    const bbox = routeBbox([route, routeJump], origin ? [origin] : []);
    if (!bbox) return { scale: 1, tx: 0, ty: 0 };
    return computeDefaultView(bbox, viewBox, wrapSize, FIT_PAD_PX);
  }, [viewBox, wrapSize, route, routeJump, origin?.x, origin?.y]);

  const clearIntroTimers = useCallback(() => {
    const tm = introTimers.current;
    if (tm.hold) { clearTimeout(tm.hold); tm.hold = undefined; }
    if (tm.raf) { cancelAnimationFrame(tm.raf); tm.raf = undefined; }
    if (tm.settle) { clearTimeout(tm.settle); tm.settle = undefined; }
  }, []);

  // 演出の後始末(タイマー破棄 + フラグ/クラス解除)。完了・中断・手動リセットの共通処理。
  const endIntro = useCallback(() => {
    clearIntroTimers();
    introActive.current = false;
    setIntroAnim(false);
    setIntroBusy(false);
  }, [clearIntroTimers]);

  // 手動「デフォルト表示に戻す」= 即座にフィット(アニメなし)。演出中でも中断してスナップ。
  const resetView = useCallback(() => {
    const target = computeTarget();
    if (!target) return;
    endIntro();
    setView(target);
  }, [computeTarget, endIntro]);

  // 目的地が変わった時だけ「全景(1倍)→ホールド→ズームイン」で着地。
  // 初回表示・リサイズ・reduced-motion は即フィット。演出中(introActive)の非ステップ変更
  // (別ワード再ロードに伴う wrapSize 更新など)は無視 → 演出を殺さない=どの家に進んでも最後まで再生。
  // paint 前に全景を確定させてチラつき(直前の家のフィットが1フレーム見える)を防ぐため useLayoutEffect。
  useLayoutEffect(() => {
    const target = computeTarget();
    if (!target) return; // 地図がまだ準備できていない(loading等)。prevStepKey は据え置き=準備できたら実行。
    const key = String(stepKey);
    // 初回に地図が準備できた瞬間も演出する(=ツアー開始1つ目のズームインを見せる)。
    // computeTarget が null の間(loading等)は上で return 済み → 地図が実際に見える状態になってから再生。
    const firstReady = prevStepKey.current === null;
    const isStepChange = prevStepKey.current !== null && prevStepKey.current !== key;
    prevStepKey.current = key;

    if ((isStepChange || firstReady) && !reduced) {
      clearIntroTimers();
      introActive.current = true;
      setIntroBusy(true);
      setIntroAnim(false);
      setView({ scale: 1, tx: 0, ty: 0 }); // まず全景を見せる
      introTimers.current.hold = window.setTimeout(() => {
        introTimers.current.raf = requestAnimationFrame(() => {
          setIntroAnim(true);
          setView(target); // CSS transition でズームイン
        });
        introTimers.current.settle = window.setTimeout(endIntro, ZOOM_SETTLE_MS);
      }, OVERVIEW_HOLD_MS);
    } else if (!introActive.current) {
      setView(target); // リサイズ/初回/同一ステップ: 演出中でなければフィットにスナップ
    }
  }, [computeTarget, clearIntroTimers, endIntro, reduced, stepKey]);

  // アンマウント時のみタイマー破棄(再実行では破棄しない=ホールド中の演出を守る)。
  useEffect(() => clearIntroTimers, [clearIntroTimers]);

  // ホイールズーム（カーソル位置固定）。React onWheel は passive で preventDefault が効かないためネイティブ登録。
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
  }, [status, svg, endIntro]); // ready の DOM 出現時にアタッチ

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
      // ピンチ→単指: 残った指でパンを継続できるよう、その指の現在位置から pan を再初期化(onPointerDown の単指分岐と同じ)。
      const [rem] = [...ptrs.current.values()];
      pan.current = { sx: rem.x, sy: rem.y, tx0: view.tx, ty0: view.ty };
    }
    if (ptrs.current.size === 0) pan.current = null;
  };

  // 起点エーテライトのラベル位置。overlay(viewBox, xMidYMid meet)→wrap px のレターボックス写像に
  // zoom transform(translate→scale, origin 0,0)を重ねて画面座標へ投影。定サイズの HTML として描く
  // (SVG 内だとズームで文字が拡縮するため)。演出中(introBusy)は view が目標へ飛ぶので隠す。
  const aetheryteLabel =
    !introBusy && status === 'ready' && originName && origin && wrapSize && viewBox
      ? (() => {
          const m = Math.min(wrapSize.w / viewBox.w, wrapSize.h / viewBox.h);
          const offX = (wrapSize.w - viewBox.w * m) / 2;
          const offY = (wrapSize.h - viewBox.h * m) / 2;
          return {
            x: (offX + origin.x * m) * view.scale + view.tx,
            y: (offY + origin.y * m) * view.scale + view.ty,
          };
        })()
      : null;

  return (
    <div className="housing-tour-map" data-region="tour-map">
      <div className="housing-tour-map-stage">
        <div
          className="housing-tour-map-wrap is-nav"
          ref={wrapRef}
          onPointerDown={status === 'ready' ? onPointerDown : undefined}
          onPointerMove={status === 'ready' ? onPointerMove : undefined}
          onPointerUp={status === 'ready' ? onPointerUp : undefined}
          onPointerCancel={status === 'ready' ? onPointerUp : undefined}
        >
          {status === 'loading' && <div className="housing-tour-map-skeleton" data-testid="tour-map-skeleton" aria-hidden="true" />}
          {(status === 'none' || status === 'error') && (
            <div className="housing-tour-map-none" data-testid="tour-map-none">
              <p className="housing-tour-map-none-text">{t(status === 'error' ? 'housing.tour.nav.map_error' : 'housing.tour.nav.map_none')}</p>
            </div>
          )}
          {status === 'ready' && svg && viewBox && (
            <div
              className={`housing-map-zoom${introAnim ? ' is-intro' : ''}`}
              style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}
              onTransitionEnd={(e) => { if (e.propertyName === 'transform') endIntro(); }}
            >
              <div ref={hostRef} className="housing-map-svg-host" role="img" aria-label={t('housing.workspace.center.map_alt')} dangerouslySetInnerHTML={{ __html: svg }} />
              <svg className="housing-map-overlay" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                {targetOutline && (
                  <path
                    className="housing-tour-target-glow"
                    data-testid="tour-map-target-glow"
                    d={
                      targetOutline
                        .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${(x * viewBox.w).toFixed(1)} ${(y * viewBox.h).toFixed(1)}`)
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
        {status === 'ready' && (
          <div className="housing-hud is-top">
            <button type="button" data-testid="tour-map-reset" className="housing-tour-map-reset" onClick={resetView}>
              {t('housing.tour.nav.reset_view')}
            </button>
          </div>
        )}
        {status === 'ready' && (
          <div className="housing-tour-map-compass" data-testid="tour-map-compass" aria-hidden="true">
            <svg viewBox="0 0 40 40">
              <circle className="housing-tour-map-compass-ring" cx="20" cy="21" r="16" />
              <path className="housing-tour-map-compass-needle-n" d="M20 8 L24.5 22 L20 19 L15.5 22 Z" />
              <path className="housing-tour-map-compass-needle-s" d="M20 34 L15.5 22 L20 25 L24.5 22 Z" />
              <text className="housing-tour-map-compass-n" x="20" y="7">N</text>
            </svg>
          </div>
        )}
        {status === 'ready' && (
          <div className="housing-tour-map-hint" data-testid="tour-map-hint" aria-hidden="true">
            {t('housing.tour.nav.map_hint')}
          </div>
        )}
      </div>
    </div>
  );
};
