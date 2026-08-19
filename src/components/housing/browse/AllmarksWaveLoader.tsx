import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';

const NUM_BARS = 15;
const BAR_WIDTH = 12;
const BAR_GAP = 8;
const BAR_STRIDE = BAR_WIDTH + BAR_GAP;

const NUM_FRAMES = 201;
const BOUNCE_COUNT = 4;
const MAX_BOUNCE = 60;
const BASE_BAR_H = 16;
const WAVE_PEAK_H = 48;
const CYCLE_SECONDS = 4;

interface WaveFrames {
  barHeights: string[][];
  barGlow: number[][];
  ballX: string[];
  ballY: string[];
  ballScaleX: number[];
  ballScaleY: number[];
  times: number[];
}

/** ユーザー提供の WavePhysicsLoader の波・跳ねるボールの物理演算をそのまま移植したもの。
 * 元コードは色を毎フレームRGB補間していたが、housingはトークン直書き禁止のため、
 * 「色そのもの」ではなく「aetherトーンの重ねぶんの不透明度(0-1)」を計算する形に変更した
 * (見た目の効果は同じ、実装だけトークン経由に)。 */
function buildWaveFrames(): WaveFrames {
  const barHeights: string[][] = Array.from({ length: NUM_BARS }, () => []);
  const barGlow: number[][] = Array.from({ length: NUM_BARS }, () => []);
  const ballX: string[] = [];
  const ballY: string[] = [];
  const ballScaleX: number[] = [];
  const ballScaleY: number[] = [];
  const times: number[] = [];

  for (let k = 0; k < NUM_FRAMES; k++) {
    const t = k / (NUM_FRAMES - 1);
    times.push(t);

    const xFrac = t < 0.5 ? t / 0.5 : (1 - t) / 0.5;
    const ballIdx = xFrac * (NUM_BARS - 1);
    ballX.push(`${ballIdx * BAR_STRIDE}px`);

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

  return { barHeights, barGlow, ballX, ballY, ballScaleX, ballScaleY, times };
}

/** 右端の家の屋根の位置(コンテナ左下からの px)。 ボールが右端(x_frac=1)で跳ね返る高さ
 * (baseBarH + wavePeakH - 20 = 44px)に合わせ、家の屋根の頂点がそこに触れるくらいの
 * 高さ・位置にする(「屋根で跳ね返る」演出、ユーザー発案)。 */
const HOUSE_X = (NUM_BARS - 1) * BAR_STRIDE + BAR_WIDTH / 2;
const HOUSE_HEIGHT = 40;

/**
 * Allmarksまとめてインポート中の進捗インジケーター (2026-08-19、ユーザー提供デザインを移植)。
 * バーが波打ちながら光り、ボールがバーの上を跳ねながら左右に往復する。 右端では家の屋根に
 * 当たって跳ね返るように見える位置に家アイコンを配置。 実際の取り込み進捗とは連動しない
 * 純粋なループ演出(通常のローディングインジケーターと同じ扱い)。
 */
export const AllmarksWaveLoader: React.FC = () => {
  const reducedMotion = useReducedMotion();
  const frames = useMemo(buildWaveFrames, []);

  return (
    <div className="housing-allmarks-wave-loader" aria-hidden>
      <div className="housing-allmarks-wave-loader-track" style={{ width: (NUM_BARS - 1) * BAR_STRIDE + BAR_WIDTH }}>
        {frames.barHeights.map((heights, i) => (
          <div key={i} className="housing-allmarks-wave-bar-wrap" style={{ width: BAR_WIDTH }}>
            <div className="housing-allmarks-wave-bar-base" />
            <motion.div
              className="housing-allmarks-wave-bar-glow"
              animate={reducedMotion ? undefined : { height: heights, opacity: frames.barGlow[i] }}
              transition={reducedMotion ? undefined : { duration: CYCLE_SECONDS, repeat: Infinity, times: frames.times, ease: 'linear' }}
              style={reducedMotion ? { height: BASE_BAR_H, opacity: 0 } : undefined}
            />
          </div>
        ))}

        <Home
          className="housing-allmarks-wave-house"
          size={HOUSE_HEIGHT}
          style={{ left: HOUSE_X }}
        />

        <motion.div
          className="housing-allmarks-wave-ball"
          animate={reducedMotion ? undefined : {
            x: frames.ballX,
            y: frames.ballY,
            scaleX: frames.ballScaleX,
            scaleY: frames.ballScaleY,
          }}
          transition={reducedMotion ? undefined : { duration: CYCLE_SECONDS, repeat: Infinity, times: frames.times, ease: 'linear' }}
          style={reducedMotion ? { transform: 'translate(0, -44px)' } : undefined}
        />
      </div>
    </div>
  );
};
