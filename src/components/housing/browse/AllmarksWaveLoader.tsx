import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';

const NUM_VISIBLE_BARS = 15;
const BAR_WIDTH = 12;
const BAR_GAP = 8;
const BAR_STRIDE = BAR_WIDTH + BAR_GAP;

/** ボール/波の物理演算を「家までの距離」を単位に統一するためのスロット数。
 * 可視バー14個ぶん(NUM_VISIBLE_BARS-1)+隙間3スロットぶんを家までの距離とする。
 * 波・バウンドの計算は最後までこの1つの空間で行い、ボールのx座標だけを別スケールで
 * 引き伸ばすようなことはしない(2026-08-19 ユーザー指摘: 別スケールにするとバウンドの
 * タイミングと波がずれて破綻する)。 */
const HOUSE_GAP_SLOTS = 3;
const TOTAL_SLOTS = (NUM_VISIBLE_BARS - 1) + HOUSE_GAP_SLOTS;

const NUM_FRAMES = 201;
const BOUNCE_COUNT = 4;
const MAX_BOUNCE = 60;
const BASE_BAR_H = 16;
const WAVE_PEAK_H = 48;
const CYCLE_SECONDS = 4;
/** 家が衝突後に元の形へ戻るまでの速さ(t単位、0.05=4秒サイクルの0.2秒間で戻り切る)。
 * 2026-08-19 ユーザー指摘: 「当たった瞬間に」反応し「もっと素早く」戻るべき。 */
const IMPACT_RECOVER_WINDOW = 0.05;

/** lucide `house.js` の外形パス(viewBox 24x24)の左屋根の斜め線: 壁との境目(ROOF_LEFT_BASE)
 * 〜 頂点寄り(ROOF_APEX)。 ボールはこの斜め線の壁寄り(下から30%)を狙う
 * (2026-08-19 ユーザー指摘: なるべく屋根の斜め部分にヒットさせる)。 */
const ICON_VIEWBOX = 24;
const ROOF_LEFT_BASE = { x: 3.709, y: 8.472 };
const ROOF_APEX = { x: 10.709, y: 2.472 };
const ROOF_HIT_FRACTION = 0.3;
const roofHitX = ROOF_LEFT_BASE.x + (ROOF_APEX.x - ROOF_LEFT_BASE.x) * ROOF_HIT_FRACTION;
const roofHitY = ROOF_LEFT_BASE.y + (ROOF_APEX.y - ROOF_LEFT_BASE.y) * ROOF_HIT_FRACTION;

/** ボールが x_frac=1 (家に到達した瞬間) に自然に跳ね上がる高さ(既存の物理式通り)。
 * 家のサイズはこの高さに屋根のヒット位置がちょうど来るよう逆算する。 */
const BALL_PEAK_HEIGHT = BASE_BAR_H + WAVE_PEAK_H - 20; // = 44
const HOUSE_SIZE = BALL_PEAK_HEIGHT / (1 - roofHitY / ICON_VIEWBOX);

const IMPACT_X = TOTAL_SLOTS * BAR_STRIDE;
const HOUSE_LEFT_X = IMPACT_X - (roofHitX / ICON_VIEWBOX) * HOUSE_SIZE;
const TRACK_WIDTH = HOUSE_LEFT_X + HOUSE_SIZE + 8;
/** `.housing-allmarks-wave-loader-track` の CSS height と一致させる (採寸フィットの縦寸に使う)。 */
const TRACK_HEIGHT = 150;

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
 * ボール位置・波の減衰は共通の TOTAL_SLOTS 空間で計算し、可視バーは先頭 NUM_VISIBLE_BARS
 * 個だけを描画する(家と被る分は最初から配列に含めない=非表示処理が要らない)。
 * 家の「衝撃でボヨンと凹んで戻る」反応(houseScaleX/Y)もここで一緒に計算する
 * (xFracが1(=家に到達)に最も近づく瞬間にピークが来るので、ボールの到達と自動で同期する)。 */
function buildWaveFrames(): WaveFrames {
  const barHeights: string[][] = Array.from({ length: NUM_VISIBLE_BARS }, () => []);
  const barGlow: number[][] = Array.from({ length: NUM_VISIBLE_BARS }, () => []);
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
    const ballIdx = xFrac * TOTAL_SLOTS;
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

    // 家の反応: 衝突の瞬間(t=0.5, xFrac=1)より前は微動だにせず、当たった瞬間に即座に
    // 凹み、そこから素早く元に戻る(予備動作なし・当たった瞬間から反応・素早く、の
    // ユーザー指摘に合わせて非対称にした — 前回は前後対称で「当たる前から凹む」
    // 不自然さがあった)。
    const sinceImpact = t - 0.5;
    const houseHit = sinceImpact >= 0 && sinceImpact < IMPACT_RECOVER_WINDOW
      ? Math.cos((sinceImpact / IMPACT_RECOVER_WINDOW) * (Math.PI / 2))
      : 0;
    houseScaleY.push(1 - houseHit * 0.28);
    houseScaleX.push(1 + houseHit * 0.22);

    for (let i = 0; i < NUM_VISIBLE_BARS; i++) {
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
 * バーが波打ちながら光り、ボールがバーの上を跳ねながら左右に往復し、右端では家の屋根の
 * 斜め部分に当たって跳ね返る(当たった瞬間、家もボヨンと凹んで元に戻る)。 実際の取り込み
 * 進捗とは連動しない純粋なループ演出(通常のローディングインジケーターと同じ扱い)。
 */
export const AllmarksWaveLoader: React.FC = () => {
  const reducedMotion = useReducedMotion();
  const frames = useMemo(buildWaveFrames, []);

  // トラックは固定幅 (TRACK_WIDTH ≈ 394px)。スマホのモーダル (実効 ~320px) では右端の家が
  // 見切れていた (2026-09-04 masaya 実機報告)。利用可能幅を採寸し、収まらなければ縮小率を
  // かけてトラック全体 (バー往復 + 家のバウンド) を最後まで見せる。物理演算の定数
  // (NUM_VISIBLE_BARS 等) には触れず、見た目だけ transform: scale で縮める
  // (定数の再スケール禁止 = 上のコメント参照)。
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const avail = el.clientWidth;
      setScale(avail > 0 ? Math.min(1, avail / TRACK_WIDTH) : 1);
    };
    measure();
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, []);

  // transition/animate オブジェクトを毎レンダー新規生成すると、進捗テキストの更新等で
  // 親が再レンダーされるたびに framer-motion がループアニメーションを最初からやり直して
  // しまい、家への到達(xFrac=1)まで辿り着けない事故になる(2026-08-19 ユーザー指摘:
  // 「家がバウンドしない」の原因)。 frames/reducedMotion が変わらない限り同一参照を
  // 保つよう useMemo でまとめて安定化する。
  const anim = useMemo(() => {
    if (reducedMotion) return null;
    const transition = { duration: CYCLE_SECONDS, repeat: Infinity, times: frames.times, ease: 'linear' as const };
    return {
      transition,
      bars: frames.barHeights.map((heights, i) => ({ height: heights, opacity: frames.barGlow[i] })),
      house: { scaleX: frames.houseScaleX, scaleY: frames.houseScaleY },
      ball: { x: frames.ballX, y: frames.ballY, scaleX: frames.ballScaleX, scaleY: frames.ballScaleY },
    };
  }, [frames, reducedMotion]);

  return (
    <div className="housing-allmarks-wave-loader" aria-hidden ref={wrapRef}>
      <div
        className="housing-allmarks-wave-loader-fit"
        style={{ width: TRACK_WIDTH * scale, height: TRACK_HEIGHT * scale }}
      >
        <div
          className="housing-allmarks-wave-loader-track"
          style={{
            width: TRACK_WIDTH,
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'top left',
          }}
        >
          {frames.barHeights.map((_, i) => (
            <div key={i} className="housing-allmarks-wave-bar-wrap" style={{ width: BAR_WIDTH }}>
              <div className="housing-allmarks-wave-bar-base" />
              <motion.div
                className="housing-allmarks-wave-bar-glow"
                animate={anim?.bars[i]}
                transition={anim?.transition}
                style={anim ? undefined : { height: BASE_BAR_H, opacity: 0 }}
              />
            </div>
          ))}

          <motion.div
            className="housing-allmarks-wave-house"
            style={{ left: HOUSE_LEFT_X }}
            animate={anim?.house}
            transition={anim?.transition}
          >
            <Home size={HOUSE_SIZE} />
          </motion.div>

          <motion.div
            className="housing-allmarks-wave-ball"
            animate={anim?.ball}
            transition={anim?.transition}
            style={anim ? undefined : { transform: 'translate(0, -44px)' }}
          />
        </div>
      </div>
    </div>
  );
};
