import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TourMapModel } from '../../../lib/housing/buildTourMapPlacements';

export interface TourNavMapProps {
  status: 'none' | 'loading' | 'ready' | 'error';
  svg: string | null;
  viewBox: { w: number; h: number } | null;
  model: TourMapModel | null;
}
const LEGEND_ITEMS = ['here', 'next', 'arrived', 'upcoming', 'route'] as const;

/** ツアー中(Nav) 中央: 表示専用の LIVE 地図(全5エリア)。現在の家のワード地図を描き、実エーテライト起点→家の経路をゴージャスにアニメ。
 * 目的地アピールは被せ矩形ではなく、地図SVG内の実際の区画/アパートのパス(#plot_N/#apart_N)自体を光らせる。host は必ず .housing-map-svg-host。 */
export const TourNavMap: React.FC<TourNavMapProps> = ({ status, svg, viewBox, model }) => {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const route = model?.routePath ?? null;
  const origin = model?.origin ?? null;
  const targetElId = model?.targetElId ?? null;

  // 目的地アピール: 埋め込み済みSVGの該当パスに光らせ用クラスを付け外し。
  // svg 差し替え(マップ切替) / targetElId 変化(ステップ移動) 両方で再適用し stale ハイライトを残さない。
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
        <div className="housing-tour-map-wrap">
          {status === 'loading' && <div className="housing-tour-map-skeleton" data-testid="tour-map-skeleton" aria-hidden="true" />}
          {(status === 'none' || status === 'error') && (
            <div className="housing-tour-map-none" data-testid="tour-map-none">
              <p className="housing-tour-map-none-text">{t(status === 'error' ? 'housing.tour.nav.map_error' : 'housing.tour.nav.map_none')}</p>
            </div>
          )}
          {status === 'ready' && svg && viewBox && (
            <>
              <div ref={hostRef} className="housing-map-svg-host" role="img" aria-label={t('housing.workspace.center.map_alt')} dangerouslySetInnerHTML={{ __html: svg }} />
              <svg className="housing-map-overlay" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                {/* 光らせるのは「ユーザーが実際に歩く経路」だけ (車のナビと同じ)。 */}
                {route && (
                  <>
                    {/* 下地グロー */}
                    <path className="housing-tour-route-glow" d={route} fill="none" />
                    {/* コア光線 + 流れ */}
                    <path data-testid="tour-map-route" className="housing-tour-route-core" d={route} fill="none">
                      <animate attributeName="stroke-dashoffset" from="0" to="-64" dur="1.1s" repeatCount="indefinite" />
                    </path>
                    {/* コメット */}
                    <circle className="housing-tour-route-comet" r="10">
                      <animateMotion dur="2.2s" repeatCount="indefinite" path={route} rotate="auto" />
                    </circle>
                  </>
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
              {model?.placed.map((node) => (
                <div key={node.index} data-testid="tour-map-node" data-status={node.status} className={`housing-tour-map-node housing-tour-map-node--${node.status}`} style={{ left: `${((node.x / viewBox.w) * 100).toFixed(3)}%`, top: `${((node.y / viewBox.h) * 100).toFixed(3)}%` }}>
                  {node.status === 'arrived' ? '✓' : node.index + 1}
                </div>
              ))}
            </>
          )}
        </div>
        <div className="housing-hud is-top"><div className="pill housing-tour-map-live"><span className="housing-tour-map-live-dot" aria-hidden="true" />{t('housing.tour.nav.live')}</div></div>
      </div>
      <ul className="housing-tour-map-legend">
        {LEGEND_ITEMS.map((key) => (<li key={key} className="housing-tour-map-legend-item"><span className={`housing-tour-map-legend-swatch housing-tour-map-legend-swatch--${key}`} aria-hidden="true" />{t(`housing.tour.nav.legend.${key}`)}</li>))}
      </ul>
    </div>
  );
};
