import { useMapRoadCycle, DRAWING_MS, FADE_MS } from '../../../lib/housing/useMapRoadCycle';
import { DrawnShape } from './DrawnShape';

const DISPLAY_WIDTH = 420;
const DISPLAY_HEIGHT = 270;

/**
 * Allmarksまとめてインポート中の演出 (2026-08-19、ユーザー発案)。
 * ゲーム内ハウジングエリアのワードマップをランダムに1つ選び、その中の一角だけをズームして
 * 切り取り、道路の線と家の区画の形が一緒にスーッと描かれる→少し止まる→消える→
 * また別のマップの別の場所で描かれる、を繰り返す。 数値の進捗は呼び出し側が別途テキストで
 * 表示するため、こちらは実際の取り込み進捗とは連動しない純粋な演出。
 */
export const AllmarksMapRoadDraw: React.FC = () => {
  const { cycleId, snippet, phase, reducedMotion } = useMapRoadCycle();

  if (!snippet || !snippet.d) {
    return <div className="housing-allmarks-map-road" style={{ width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT }} aria-hidden />;
  }

  const isDrawing = !reducedMotion && phase === 'drawing';
  const fading = !reducedMotion && phase === 'fading';

  return (
    <div
      className={`housing-allmarks-map-road${fading ? ' housing-allmarks-map-road-fading' : ''}`}
      style={{ width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT, transitionDuration: `${FADE_MS}ms` }}
      aria-hidden
    >
      <svg
        viewBox={`${snippet.crop.x} ${snippet.crop.y} ${snippet.crop.w} ${snippet.crop.h}`}
        className="housing-allmarks-map-road-svg"
      >
        {snippet.houses.map((outline, i) => (
          <DrawnShape
            key={`${cycleId}-house-${i}`}
            points={outline.map((p) => `${p.x},${p.y}`).join(' ')}
            animate={isDrawing}
            durationMs={DRAWING_MS}
            className="housing-allmarks-map-road-house"
          />
        ))}
        <DrawnShape
          key={cycleId}
          d={snippet.d}
          animate={isDrawing}
          durationMs={DRAWING_MS}
          className="housing-allmarks-map-road-path"
        />
      </svg>
    </div>
  );
};
