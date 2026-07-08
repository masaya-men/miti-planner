import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TourMapModel } from '../../../lib/housing/buildTourMapPlacements';
import { applyWheelZoom, zoomAt, type MapView } from '../../../lib/housing/mapZoom';
import { computeDefaultView, routeBbox } from '../../../lib/housing/mapDefaultView';

export interface TourNavMapProps {
  status: 'none' | 'loading' | 'ready' | 'error';
  svg: string | null;
  viewBox: { w: number; h: number } | null;
  model: TourMapModel | null;
}

const FIT_PAD_PX = 28; // 既定表示で経路が端に貼り付かない余白（実画面ゲートで調整可）

/** ツアー中(Nav) 中央: 実エーテライト起点→家の経路をアニメし、目的地の実区画(#plot_N/#apart_N)を光らせるナビ地図。
 * 地図は指/マウスでパン&ズーム可。既定は起点〜家の経路にフィット（見切れ厳禁）、ステップが変わると自動で既定へ戻る。 */
export const TourNavMap: React.FC<TourNavMapProps> = ({ status, svg, viewBox, model }) => {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const route = model?.routePath ?? null;
  const routeJump = model?.routeJumpPath ?? null;
  const origin = model?.origin ?? null;
  const targetElId = model?.targetElId ?? null;

  const [view, setView] = useState<MapView>({ scale: 1, tx: 0, ty: 0 });
  const [wrapSize, setWrapSize] = useState<{ w: number; h: number } | null>(null);

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

  // 既定表示へリセット（起点〜家の経路にフィット）。ステップ変更(route/target)と wrap リサイズで再計算。手動パン/ズームは次のステップまで保持。
  const resetView = useCallback(() => {
    if (!viewBox || !wrapSize) return;
    const bbox = routeBbox([route, routeJump], origin ? [origin] : []);
    if (!bbox) { setView({ scale: 1, tx: 0, ty: 0 }); return; }
    setView(computeDefaultView(bbox, viewBox, wrapSize, FIT_PAD_PX));
    // deps は origin オブジェクトでなく座標プリミティブで比較。mapModel 再生成で origin 参照だけ変わる背景更新では
    // リセットを起こさず、実ステップ変更(route 文字列が必ず変わる)時のみ既定へ戻す=手動パン/ズームを次ステップまで保持。
  }, [viewBox, wrapSize, route, routeJump, origin?.x, origin?.y]);

  useEffect(() => { resetView(); }, [resetView]);

  // ホイールズーム（カーソル位置固定）。React onWheel は passive で preventDefault が効かないためネイティブ登録。
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      setView((v) => applyWheelZoom(v, e.clientX - r.left, e.clientY - r.top, e.deltaY));
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, [status, svg]); // ready の DOM 出現時にアタッチ

  // パン(1本指/ドラッグ) + ピンチ(2本指)。pointer events で PC/タッチ統一。
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pan = useRef<{ sx: number; sy: number; tx0: number; ty0: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const localXY = (clientX: number, clientY: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
  };
  const onPointerDown = (e: React.PointerEvent) => {
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

  // 目的地アピール: 埋め込み済み SVG の該当パスに光らせ用クラスを付け外し。svg 差し替え/targetElId 変化の両方で再適用し stale を残さない。
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.querySelectorAll('.housing-tour-target-box').forEach((el) => el.classList.remove('housing-tour-target-box'));
    if (!targetElId) return;
    const el = host.querySelector(`[id="${targetElId}"]`);
    if (el) el.classList.add('housing-tour-target-box');
  }, [status, svg, targetElId]);

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
            <div className="housing-map-zoom" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}>
              <div ref={hostRef} className="housing-map-svg-host" role="img" aria-label={t('housing.workspace.center.map_alt')} dangerouslySetInnerHTML={{ __html: svg }} />
              <svg className="housing-map-overlay" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
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
      </div>
    </div>
  );
};
