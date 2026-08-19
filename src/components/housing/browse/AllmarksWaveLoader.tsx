import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';

const NUM_BARS = 15;
const BAR_WIDTH = 12;
const BAR_GAP = 8;
const BAR_STRIDE = BAR_WIDTH + BAR_GAP;
const BARS_WIDTH = (NUM_BARS - 1) * BAR_STRIDE + BAR_WIDTH;

const NUM_FRAMES = 201;
const BOUNCE_COUNT = 4;
const MAX_BOUNCE = 60;
const BASE_BAR_H = 16;
const WAVE_PEAK_H = 48;
const CYCLE_SECONDS = 4;

/** バー列と家の間の隙間(px)。 インジケーター(バー)に家が被らないようにする
 * (2026-08-19 ユーザー指摘)。 */
const HOUSE_GAP = 36;
const HOUSE_SIZE = 52;
/** 家の中心x座標。 ボールの右端到達点(IMPACT_X)もここに合わせ、実際に屋根へ当たって
 *見えるようにする(以前はバー基準の位置までしか飛ばず、家まで届いていなかった)。 */
const HOUSE_CENTER_X = BARS_WIDTH + HOUSE_GAP + HOUSE_SIZE / 2;
const IMPACT_X = HOUSE_CENTER_X;
const TRACK_WIDTH = HOUSE_CENTER_X + HOUSE_SIZE / 2;

/** 家が衝撃で反応する範囲(xFracの残り距離がこの値未満で「ボヨン」を発火)。 */
const IMPACT_WINDOW = 0.15;

interface WaveFrames {
  barHeights: string[][];
  barGlow: number[][];
  ballX: string[];
  ballY: string[];
  ballScaleX: number[];
  ballScaleY: number[];
  houseScaleX: number[];
  houseScaleY: number[];
  times: number[];
}

/** ユーザー提供の WavePhysicsLoader の波・跳ねるボールの物理演算をそのまま移植したもの。
 * 元コードは色を毎フレームRGB補間していたが、housingはトークン直書き禁止のため、
 * 「色そのもの」ではなく「aetherトーンの重ねぶんの不透明度(0-1)」を計算する形に変更した
 * (見た目の効果は同じ、実装だけトークン経由に)。
 * ボールのx位置は元コードでは最後のバーまでしか飛ばなかったが、家の中心(IMPACT_X)まで
 * 届くよう拡張(バーの波の計算自体はバー番号空間のまま=見た目は変えない)。
 * 家の「衝撃でボヨンと凹んで戻る」反応(houseScaleX/Y)もここで一緒に計算する
 * (xFracが1(=家に到達)に最も近づく瞬間にピークが来るので、ボールの到達と自動で同期する)。 */
function buildWaveFrames(): WaveFrames {
  const barHeights: string[][] = Array.from({ length: NUM_BARS }, () => []);
  const barGlow: number[][] = Array.from({ length: NUM_BARS }, () => []);
  const ballX: string[] = [];
  const ballY: string[] = [];
  const ballScaleX: number[] = [];
  const ballScaleY: number[] = [];
  const houseScaleX: number[] = [];
  const houseScaleY: number[] = [];
  const times: number[] = [];

  for (let k = 0; k < NUM_FRAMES; k++) {
    const t = k / (NUM_FRAMES - 1);
    times.push(t);

    const xFrac = t < 0.5 ? t / 0.5 : (1 - t) / 0.5;
    const ballIdx = xFrac * (NUM_BARS - 1); // バーの波の計算用(バー番号空間)
    ballX.push(`${xFrac * IMPACT_X}px`); // ボール自体の見た目上の位置(家まで届く)

    let bounceF = (xFrac * BOUNCE_COUNT) % 1;
    if (xFrac === 1 || xFrac === 0) bounceF = 0;
    const bounceH = 4 * bounceF * (1 - bounceF);
    const heightFactor = Math.max(0, 1 - bounceH * 2);
    const ballIndent = heightFactor * 20;
    const ballYv = (BASE_BAR_H + WAVE_PEAK_H - ballIndent) + bounceH * MAX_BOUNCE;
    ballY.push(`-${ballYv}px`);

    const squish = heightFactor;
    ballScaleY.push(1 - squish * 0.3);
    ballScaleX.push(1 + squish * 0.25);

    const distFromImpact = Math.abs(xFrac - 1);
    const houseHit = distFromImpact < IMPACT_WINDOW
      ? Math.cos((distFromImpact / IMPACT_WINDOW) * (Math.PI / 2))
      : 0;
    houseScaleY.push(1 - houseHit * 0.28);
    houseScaleX.push(1 + houseHit * 0.22);

    for (let i = 0; i < NUM_BARS; i++) {
      const dist = Math.abs(i - ballIdx);
      const waveVal = dist < 3 ? Math.cos((dist / 3) * (Math.PI / 2)) : 0;
      let indent = 0;
      if (dist < 1.5) {
        const indentDist = Math.cos((dist / 1.5) * (Math.PI / 2));
        indent = indentDist * heightFactor * 20;
      }
      const barH = BASE_BAR_H + waveVal * WAVE_PEAK_H - indent;
      barHeights[i].push(`${Math.max(4, barH)}px`);
      barGlow[i].push(waveVal);
    }
  }

  return { barHeights, barGlow, ballX, ballY, ballScaleX, ballScaleY, houseScaleX, houseScaleY, times };
}

/**
 * Allmarksまとめてインポート中の進捗インジケーター (2026-08-19、ユーザー提供デザインを移植)。
 * バーが波打ちながら光り、ボールがバーの上を跳ねながら左右に往復し、右端では家の屋根に
 * 当たって跳ね返る(当たった瞬間、家もボヨンと凹んで元に戻る)。 実際の取り込み進捗とは
 * 連動しない純粋なループ演出(通常のローディングインジケーターと同じ扱い)。
 */
export const AllmarksWaveLoader: React.FC = () => {
  const reducedMotion = useReducedMotion();
  const frames = useMemo(buildWaveFrames, []);
  const transition = reducedMotion ? undefined : { duration: CYCLE_SECONDS, repeat: Infinity, times: frames.times, ease: 'linear' as const };

  return (
    <div className="housing-allmarks-wave-loader" aria-hidden>
      <div className="housing-allmarks-wave-loader-track" style={{ width: TRACK_WIDTH }}>
        {frames.barHeights.map((heights, i) => (
          <div key={i} className="housing-allmarks-wave-bar-wrap" style={{ width: BAR_WIDTH }}>
            <div className="housing-allmarks-wave-bar-base" />
            <motion.div
              className="housing-allmarks-wave-bar-glow"
              animate={reducedMotion ? undefined : { height: heights, opacity: frames.barGlow[i] }}
              transition={transition}
              style={reducedMotion ? { height: BASE_BAR_H, opacity: 0 } : undefined}
            />
          </div>
        ))}

        <motion.div
          className="housing-allmarks-wave-house"
          style={{ left: HOUSE_CENTER_X, marginLeft: -HOUSE_SIZE / 2 }}
          animate={reducedMotion ? undefined : { scaleX: frames.houseScaleX, scaleY: frames.houseScaleY }}
          transition={transition}
        >
          <Home size={HOUSE_SIZE} />
        </motion.div>

        <motion.div
          className="housing-allmarks-wave-ball"
          animate={reducedMotion ? undefined : {
            x: frames.ballX,
            y: frames.ballY,
            scaleX: frames.ballScaleX,
            scaleY: frames.ballScaleY,
          }}
          transition={transition}
          style={reducedMotion ? { transform: 'translate(0, -44px)' } : undefined}
        />
      </div>
    </div>
  );
};
