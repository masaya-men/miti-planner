import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { applyWheelZoom } from '../../../lib/housing/mapZoom';
import { termLabel } from '../../../lib/housing/housingTerms';
import { pickRegionLocale } from '../../../data/housing/regionMap';
import type { TourNavMapProps } from './tourNavMapTypes';
import { TourNavMapAddress } from './TourNavMapAddress';
import { TourNavMapCrossing } from './TourNavMapCrossing';
import { TourNavMapOverlay } from './TourNavMapOverlay';
import { useTourMapPointerGestures } from './useTourMapPointerGestures';
import { useTourNavMapView } from './useTourNavMapView';
import './TourNavMap.css';


/** ツアー中(Nav) 中央: 実エーテライト起点→家の経路をアニメし、目的地の実区画を光らせるナビ地図。
 * 目的地が変わると「ズームアウト→フェードで地図をシームレス切替→ズームイン」で着地。指/マウスでパン&ズーム可。 */
export const TourNavMap: React.FC<TourNavMapProps> = ({
  status, svg, viewBox, model, stepKey, originName,
  crossing = { kind: 'none' }, showCrossing = false,
  crossingReadOnly = false, addressListing = null, footerDirections = null,
  viewingTimerText = null, inviteHint = null,
}) => {
  const { t, i18n } = useTranslation();
  const locale = pickRegionLocale(i18n.language);
  // originName はモデル層(useTourRenderModel/buildTourMapPlacements)から ja のまま渡ってくる。
  // KR/CN の辞書名変換はここ(実際に画面へ描く直前)で一度だけ行う(呼び出し元4箇所が全てここを通る)。
  const originLabel = originName ? termLabel('aetheryte', originName, locale) : null;
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const {
    view, setView, wrapSize, displayed, mapHidden, introAnim, introBusy, zoomingIn, endIntro, resetView,
  } = useTourNavMapView({ status, svg, viewBox, model, stepKey }, wrapRef);

  // 表示中の地図から overlay 用の派生値(すべて displayed 由来。props 直参照はしない=バッファのため)。
  const dm = displayed?.model ?? null;
  const dSvg = displayed?.svg ?? null;
  const dViewBox = displayed?.viewBox ?? null;
  const route = dm?.routePath ?? null;
  const routeJump = dm?.routeJumpPath ?? null;
  const origin = dm?.origin ?? null;
  const targetOutline = dm?.targetOutline ?? null;

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
  }, [endIntro, setView]);

  const { onPointerDown, onPointerMove, onPointerUp } = useTourMapPointerGestures(wrapRef, view, setView, endIntro);


  // 起点エーテライトのラベル位置。overlay(viewBox, xMidYMid meet)→wrap px のレターボックス写像に
  // zoom transform(translate→scale, origin 0,0)を重ねて画面座標へ投影。定サイズ HTML。演出/フェード中は隠す。
  const aetheryteLabel =
    !introBusy && !mapHidden && originLabel && origin && wrapSize && dViewBox
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
              <TourNavMapOverlay
                dViewBox={dViewBox}
                targetOutline={targetOutline}
                route={route}
                routeJump={routeJump}
                origin={origin}
              />
            </div>
          )}
          {aetheryteLabel && (
            <div
              className="housing-tour-map-aetheryte-label"
              style={{ left: `${aetheryteLabel.x}px`, top: `${aetheryteLabel.y}px` }}
              data-testid="tour-map-aetheryte-label"
            >
              {originLabel}
            </div>
          )}
        </div>
        {/* 左上フル住所オーバーレイ(共有ツアー同期): showcase と同じ canDisplayFullAddress ゲート。
            表示のみ(地図操作を邪魔しないよう pointer-events:none)。
            実機FB(2026-08-10): 住所だけだとテレポ後にどこへ向かうべきか分からなかったため、
            2段目に最寄りエーテライト名を追加。エーテライト名には拡張街だと公式に「[拡張街]」
            プレフィックスが付くため、あわせて号地(plot)から拡張街かを判定し小さなバッジも出す。 */}
        {addressListing && (
          <TourNavMapAddress addressListing={addressListing} originLabel={originLabel} />
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
        {/* 実機FB: スマホの見学開始は全画面ショーケースを開かなくなったため、代わりにコンパスの下へ
            見学中の経過時間チップを出す(地図操作の邪魔をしない pointer-events:none)。 */}
        {viewingTimerText && (
          <div className="housing-tour-map-viewing-timer" data-testid="tour-mobile-viewing-timer">
            {viewingTimerText}
          </div>
        )}
        {displayed && (
          <div className="housing-tour-map-hint" data-testid="tour-map-hint" aria-hidden="true">
            {t('housing.tour.nav.map_hint')}
          </div>
        )}
        {/* 実機FB#4: スマホ下部バーの1行省略表示に代わり、行き方を地図下部の帯へ全文表示する。
            実機FB第6弾#7: 1行目=最寄りエーテライト/2行目以降=行き方全文の2段構成(連結した1本の文字列だと境目が読み取りづらいため)。
            マウス向けの上のヒント(ホイールでズーム)はスマホでは TourNavMap.css 側で非表示にする。 */}
        {(footerDirections || inviteHint) && (
          <div className="housing-tour-map-directions" data-testid="tour-map-footer-directions">
            {footerDirections && (
              <>
                <div className="housing-tour-map-directions-teleport">{footerDirections.teleport}</div>
                {footerDirections.directions && (
                  <div className="housing-tour-map-directions-body">{footerDirections.directions}</div>
                )}
              </>
            )}
            {inviteHint && (
              <div className="housing-tour-map-invite-hint" data-testid="tour-map-invite-hint">
                {inviteHint}
              </div>
            )}
          </div>
        )}
        {showCrossing && crossing.kind !== 'none' && (
          <TourNavMapCrossing crossing={crossing} crossingReadOnly={crossingReadOnly} />
        )}
      </div>
    </div>
  );
};
