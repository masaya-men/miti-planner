import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { scalePx } from '../../../lib/housing/housingScale';
import type { TourMapModel } from '../../../lib/housing/buildTourMapPlacements';
import type { MapView } from '../../../lib/housing/mapZoom';
import { computeDefaultView, routeBbox } from '../../../lib/housing/mapDefaultView';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';
import type { TourNavMapProps } from './tourNavMapTypes';

const FIT_PAD_PX = 28;         // 既定表示で経路が端に貼り付かない余白（実画面ゲートで調整可）
const OVERVIEW_HOLD_MS = 350;  // 初回のみ: 全景を見せてからズームインを始めるまでの間
const OUT_MS = 550;            // ステップ変更: ズームアウト+フェードアウトの尺(この後に地図を差し替える)
const ZOOM_SETTLE_MS = 1000;   // ズームイン完了の保険(transitionend 不発時=全景と目標が同一等でも演出解除)
const OUT_FALLBACK_MS = 4000;  // 保険: dip開始からこの時間内に新地図が ready にならなければ旧地図を可視復帰し無限ブランクを防ぐ

/** バッファ表示する1枚の地図データ。loading 中も旧地図をこの形で保持し、スケルトンの「パッ」を消す。 */
type MapData = { svg: string; viewBox: { w: number; h: number }; model: TourMapModel | null };

/**
 * TourNavMap のパン/ズーム状態と、目的地変更時の「ズームアウト→フェードで地図切替→ズームイン」演出の状態機械。
 * 表示中の地図 (displayed) のバッファ・wrap の実寸観測・既定フィット計算・演出タイマーを持つ。
 */
export function useTourNavMapView(
  { status, svg, viewBox, model, stepKey }: Pick<TourNavMapProps, 'status' | 'svg' | 'viewBox' | 'model' | 'stepKey'>,
  wrapRef: React.RefObject<HTMLDivElement | null>,
) {
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
  }, [wrapRef]);

  // 指定の地図データ+wrap px から既定(フィット)ビューを計算する純関数。
  const computeTargetFor = useCallback((md: MapData | null, ws: { w: number; h: number } | null): MapView | null => {
    if (!md?.viewBox || !ws) return null;
    const m = md.model;
    const bbox = routeBbox([m?.routePath, m?.routeJumpPath], m?.origin ? [m.origin] : []);
    if (!bbox) return { scale: 1, tx: 0, ty: 0 };
    return computeDefaultView(bbox, md.viewBox, ws, scalePx(FIT_PAD_PX, wrapRef.current));
  }, [wrapRef]);

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
        // アイドル中の背景更新(同一ステップの overlay 差し替え・アニメ無し)。
        // 実機FB⑥: RegisterAddressMap は同一ワード地図内で番地を手入力すると stepKey は
        // 変わらず model (origin/target/route) だけ差し替わる。従来は overlay の中身は
        // 新しい位置に更新される一方、パン/ズーム(view)は前回フィットしたまま据え置きだった
        // ため、ハイライトが画面上の意図しない位置にずれて見えた(番地チップの上下クリックは
        // 副次的に発生するリサイズ経由の再フィット(下の layoutEffect)を誘発するため直って見えていた)。
        // ここでも同じフィット計算を行い、対象へ即座に(アニメ無しで)再センタリングする。
        const md = { svg, viewBox, model };
        setDisplayedBoth(md);
        const target = computeTargetFor(md, wrapSizeRef.current);
        if (target) setView(target);
      }
      tryDoSwap(); // 差し替え待ちなら実行
    } else if (status === 'none' || status === 'error') {
      // 現ステップに地図が無い/失敗: 演出を畳んでバッファをクリア→none/error 表示。
      endIntro();
      if (displayedRef.current) setDisplayedBoth(null);
    }
    // status === 'loading': 何もしない(旧地図を出したまま=ポップ回避)
  }, [status, svg, viewBox, model, stepKey, tryDoSwap, endIntro, setDisplayedBoth, computeTargetFor]);

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

  return { view, setView, wrapSize, displayed, mapHidden, introAnim, introBusy, zoomingIn, endIntro, resetView };
}
