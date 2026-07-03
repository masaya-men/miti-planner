import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { buildRoutePath, plotToPlacement, nodeToPoint, MAP_VIEWBOX } from '../../../lib/housing/wardRoute';
import type { StepStatus } from '../../../lib/housing/tourNav';
// ミスト SVG (家の模型 / 道路(Stroke) / エーテライト / Node / ナビ赤線 全部入り) を inline 展開。
// host class は MapView.tsx と同じ .housing-map-svg-host にする (赤線/Node の [stroke="#FF0000"] 隠蔽 CSS が
// このセレクタ配下でしか効かないため。別 class にすると Node の赤丸が可視のまま残る = 過去の実バグ)。
import mistSvgRaw from '../../../data/housing/mist.generated.svg?raw';
import mistWard from '../../../data/housing/mistWard.generated.json';

export interface PlacedStep {
  index: number;
  plot: number;
  status: StepStatus;
}

export interface TourNavMapProps {
  placed: PlacedStep[];
  currentPlot: number | null;
  originNodeId: string;
}

const W = MAP_VIEWBOX.w;
const H = MAP_VIEWBOX.h;

const LEGEND_ITEMS = ['here', 'next', 'arrived', 'upcoming', 'route'] as const;

/**
 * ツアー中(Nav) 中央カラム: 実データ駆動の LIVE 地図。
 * MapView.tsx の演出 (道アンビエント / 光ナビ / 目的地の波紋・脈打ち / コンパス的 HUD) を
 * DEMO_PLOTS のローカル state から props 駆動へ作り替えたもの。
 * 現在地(originNodeId) → 目的地(currentPlot) への光る道を引く。
 */
export const TourNavMap: React.FC<TourNavMapProps> = ({ placed, currentPlot, originNodeId }) => {
  const { t } = useTranslation();

  const currentPlacement = useMemo(
    () => (currentPlot !== null ? plotToPlacement(currentPlot) : null),
    [currentPlot],
  );

  // 光ナビ経路: buildRoutePath は node→node で終わり、玄関座標までの最後の1ホップを含まない。
  // MapView.tsx:104 と同じく、経路末尾に目的地の玄関座標を追記して届かせる。
  const routePath = useMemo(() => {
    if (!currentPlacement || !currentPlacement.nodeId) return null;
    const base = buildRoutePath(originNodeId, currentPlacement.nodeId);
    if (!base) return null;
    return `${base} L${currentPlacement.x.toFixed(1)} ${currentPlacement.y.toFixed(1)}`;
  }, [currentPlacement, originNodeId]);

  const originPoint = useMemo(() => nodeToPoint(originNodeId), [originNodeId]);

  const placedNodes = useMemo(
    () =>
      placed
        .map((step) => ({ step, placement: plotToPlacement(step.plot) }))
        .filter((x): x is { step: PlacedStep; placement: NonNullable<ReturnType<typeof plotToPlacement>> } => x.placement !== null),
    [placed],
  );

  return (
    <div className="housing-tour-map" data-region="tour-map">
      <div className="housing-tour-map-stage">
        <div className="housing-tour-map-wrap">
          {/* ① Figma マップを inline 展開 (家 / 道 / エーテライト全部入り) */}
          <div
            className="housing-map-svg-host"
            role="img"
            aria-label={t('housing.workspace.center.map_alt')}
            dangerouslySetInnerHTML={{ __html: mistSvgRaw }}
          />

          {/* ② 動的レイヤー: 光ナビ + アンビエント (赤線/Node は ① 内で透明化済) */}
          <svg
            className="housing-map-overlay"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            {/* 道全体を巡るアンビエント (dash パターンが流れる) */}
            <path
              d={mistWard.roadPath}
              fill="none"
              stroke="var(--housing-candle)"
              strokeOpacity="0.6"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="14 28"
              style={{ filter: 'drop-shadow(0 0 6px var(--housing-honey))' }}
            >
              <animate attributeName="stroke-dashoffset" from="0" to="-42" dur="2.4s" repeatCount="indefinite" />
            </path>

            {/* 現在地(origin) → 目的地(currentPlot) への光ナビ */}
            {routePath && (
              <>
                <path
                  data-testid="tour-map-route"
                  d={routePath}
                  fill="none"
                  stroke="var(--housing-honey)"
                  strokeOpacity="0.85"
                  strokeWidth="4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  style={{ filter: 'drop-shadow(0 0 5px var(--housing-honey))' }}
                />
                <circle r="9" fill="var(--housing-map-light)" style={{ filter: 'drop-shadow(0 0 10px var(--housing-candle))' }}>
                  <animateMotion dur="2.4s" repeatCount="indefinite" path={routePath} rotate="auto" />
                </circle>
              </>
            )}

            {/* 目的地アピール (波紋リング 2 重位相 + 中心ハイライト矩形の脈打ち) */}
            {currentPlacement && (
              <g aria-hidden="true">
                {[0, 0.9].map((begin) => (
                  <circle
                    key={begin}
                    cx={currentPlacement.x}
                    cy={currentPlacement.y}
                    r="60"
                    fill="none"
                    stroke="var(--housing-candle)"
                    strokeWidth="6"
                    style={{ filter: 'drop-shadow(0 0 10px var(--housing-honey))' }}
                  >
                    <animate attributeName="r" from="60" to="170" dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" from="0.95" to="0" dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
                    <animate attributeName="stroke-width" from="8" to="2" dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
                  </circle>
                ))}
                <rect
                  x={currentPlacement.x - 75}
                  y={currentPlacement.y - 55}
                  width="150"
                  height="110"
                  rx="10"
                  fill="var(--housing-honey)"
                  fillOpacity="0.22"
                  stroke="var(--housing-honey)"
                  strokeWidth="6"
                  style={{ filter: 'drop-shadow(0 0 16px var(--housing-honey))' }}
                >
                  <animate attributeName="stroke-opacity" values="1;0.45;1" dur="1.4s" repeatCount="indefinite" />
                  <animate attributeName="fill-opacity" values="0.34;0.16;0.34" dur="1.4s" repeatCount="indefinite" />
                </rect>
              </g>
            )}

            {/* 現在地マーカー (originNodeId のノード座標に青丸) */}
            {originPoint && (
              <circle
                className="housing-tour-map-origin"
                cx={originPoint.x}
                cy={originPoint.y}
                r="9"
              />
            )}
          </svg>

          {/* ③ 番号ノード (状態色: arrived=honey+チェック / current=aether / upcoming=グレー) */}
          {placedNodes.map(({ step, placement }) => (
            <div
              key={step.plot}
              data-testid="tour-map-node"
              data-status={step.status}
              className={`housing-tour-map-node housing-tour-map-node--${step.status}`}
              style={{ left: `${((placement.x / W) * 100).toFixed(3)}%`, top: `${((placement.y / H) * 100).toFixed(3)}%` }}
            >
              {step.status === 'arrived' ? '✓' : step.index + 1}
            </div>
          ))}
        </div>

        <div className="housing-hud is-top">
          <div className="pill housing-tour-map-live">
            <span className="housing-tour-map-live-dot" aria-hidden="true" />
            {t('housing.tour.nav.live')}
          </div>
        </div>
      </div>

      <ul className="housing-tour-map-legend">
        {LEGEND_ITEMS.map((key) => (
          <li key={key} className="housing-tour-map-legend-item">
            <span className={`housing-tour-map-legend-swatch housing-tour-map-legend-swatch--${key}`} aria-hidden="true" />
            {t(`housing.tour.nav.legend.${key}`)}
          </li>
        ))}
      </ul>
    </div>
  );
};
