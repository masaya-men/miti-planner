import type { TourMapModel } from '../../../lib/housing/buildTourMapPlacements';

interface TourNavMapOverlayProps {
  dViewBox: { w: number; h: number };
  targetOutline: TourMapModel['targetOutline'] | null;
  route: string | null;
  routeJump: string | null;
  origin: { x: number; y: number } | null;
}

/** TourNavMap の地図に重ねる SVG: 目的地の実区画の発光・経路アニメ・ジャンプ破線・起点エーテライトの脈動。 */
export const TourNavMapOverlay: React.FC<TourNavMapOverlayProps> = ({ dViewBox, targetOutline, route, routeJump, origin }) => {
  return (
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
  );
};
