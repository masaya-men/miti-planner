import { Home } from 'lucide-react';
import { useFallingHousesCycle } from '../../../lib/housing/useFallingHousesCycle';
import {
  CONTAINER_WIDTH,
  CONTAINER_HEIGHT,
  FALL_DURATION_MS,
  FALL_STAGGER_MS,
  PATH_DRAW_MS,
  WALK_MS,
  FADE_MS,
} from '../../../lib/housing/fallingHousesCycle';

/**
 * Allmarksまとめてインポート中の演出 (2026-08-19、ユーザー発案)。
 * 家が1つずつ降ってきて、4〜6個たまると道でつながり、光の粒がその道を歩いて消え、
 * また最初から降ってくる、を繰り返す。 数値の進捗は呼び出し側が別途テキストで表示するため、
 * こちらは実際の取り込み進捗とは連動しない純粋な演出。
 */
export const AllmarksFallingHouses: React.FC = () => {
  const { cycleId, houses, order, pathD, phase, reducedMotion } = useFallingHousesCycle();

  const showPath = reducedMotion || phase === 'path' || phase === 'walking' || phase === 'hold';
  const pathIsDrawing = !reducedMotion && phase === 'path';
  const showTraveler = !reducedMotion && (phase === 'walking' || phase === 'hold');
  const fading = !reducedMotion && phase === 'fading';
  const pathId = `housing-allmarks-falling-houses-path-${cycleId}`;

  return (
    <div
      className={`housing-allmarks-falling-houses${fading ? ' housing-allmarks-falling-houses-fading' : ''}`}
      style={{ width: CONTAINER_WIDTH, height: CONTAINER_HEIGHT, transitionDuration: `${FADE_MS}ms` }}
      aria-hidden
    >
      <svg
        className="housing-allmarks-falling-houses-svg"
        viewBox={`0 0 ${CONTAINER_WIDTH} ${CONTAINER_HEIGHT}`}
      >
        {showPath && pathD && (
          <path
            key={pathId}
            id={pathId}
            d={pathD}
            className={
              pathIsDrawing
                ? 'housing-allmarks-falling-houses-path housing-allmarks-falling-houses-path-drawing'
                : 'housing-allmarks-falling-houses-path'
            }
            style={pathIsDrawing ? { animationDuration: `${PATH_DRAW_MS}ms` } : undefined}
          />
        )}
        {showTraveler && pathD && (
          <circle r={4} className="housing-allmarks-falling-houses-traveler">
            <animateMotion dur={`${WALK_MS}ms`} fill="freeze" repeatCount="1">
              <mpath href={`#${pathId}`} />
            </animateMotion>
          </circle>
        )}
      </svg>
      {order.map((houseIdx, orderPos) => {
        const point = houses[houseIdx];
        return (
          <Home
            key={`${cycleId}-${houseIdx}`}
            size={18}
            className={
              reducedMotion
                ? 'housing-allmarks-falling-houses-house'
                : 'housing-allmarks-falling-houses-house housing-allmarks-falling-houses-house-fall'
            }
            style={{
              left: point.x,
              top: point.y,
              animationDelay: reducedMotion ? undefined : `${orderPos * FALL_STAGGER_MS}ms`,
              animationDuration: reducedMotion ? undefined : `${FALL_DURATION_MS}ms`,
            }}
          />
        );
      })}
    </div>
  );
};
