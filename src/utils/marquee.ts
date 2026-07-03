/** ホバー・マーキー(見切れ攻撃名の横スクロール)の計測結果。 */
export interface MarqueeMetrics {
  /** 見切れているか(= マーキー対象か)。 */
  clipped: boolean;
  /** translateX の終端値(px・負数)。非クリップ時 0。 */
  distancePx: number;
  /** アニメーション総時間(秒)。非クリップ時 0。 */
  durationSec: number;
}

export interface MarqueeOptions {
  /** 読みやすいスクロール速度(px/秒)。既定 40。 */
  speedPxPerSec?: number;
  /** keyframes 上で片道スクロールに充てる時間割合(0..1)。既定 0.35。 */
  motionFraction?: number;
  /** 総時間の下限(秒)。既定 1.2。 */
  minDurationSec?: number;
  /** 総時間の上限(秒)。既定 8。 */
  maxDurationSec?: number;
}

/**
 * 内側テキスト全幅と外側クリップ窓幅から、マーキー要否・移動距離・所要時間を算出する純関数。
 * DOM 計測値(scrollWidth / clientWidth)を引数で受け取り、ホバー時ではなく
 * ResizeObserver コールバック内で1回だけ呼ぶ前提(forced reflow 回避)。
 */
export function computeMarqueeMetrics(
  textWidth: number,
  clipWidth: number,
  opts: MarqueeOptions = {},
): MarqueeMetrics {
  const {
    speedPxPerSec = 40,
    motionFraction = 0.35,
    minDurationSec = 1.2,
    maxDurationSec = 8,
  } = opts;

  const overflow = textWidth - clipWidth;
  if (overflow <= 0) {
    return { clipped: false, distancePx: 0, durationSec: 0 };
  }

  const rawDuration = overflow / speedPxPerSec / motionFraction;
  const durationSec = Math.min(maxDurationSec, Math.max(minDurationSec, rawDuration));

  return {
    clipped: true,
    distancePx: -Math.round(overflow),
    durationSec: Math.round(durationSec * 100) / 100,
  };
}

export interface MarqueeLoopOptions {
  /** ゆっくり流す速度(px/秒)。既定 28 (ハウジングカードの静かなティッカー用)。 */
  speedPxPerSec?: number;
  /** 1周時間の下限(秒)。既定 6。 */
  minDurationSec?: number;
}

/**
 * 無限ループ型マーキー (「あいうえお　　あいうえお　　…」と左へ流れ続けるティッカー) の計算。
 * 往復型 computeMarqueeMetrics とは別物。
 * - contentWidth: テキスト本体の幅 (ギャップを含まない) → 見切れ判定に使う
 * - loopWidth: 1コピー+ギャップの幅 (= コピー要素の offsetWidth) → 1周の移動距離
 * どちらも DOM 計測値を ResizeObserver コールバックで渡す前提 (forced reflow 回避)。
 */
export function computeMarqueeLoopMetrics(
  contentWidth: number,
  loopWidth: number,
  clipWidth: number,
  opts: MarqueeLoopOptions = {},
): MarqueeMetrics {
  const { speedPxPerSec = 28, minDurationSec = 6 } = opts;

  if (contentWidth <= clipWidth) {
    return { clipped: false, distancePx: 0, durationSec: 0 };
  }

  const durationSec = Math.max(minDurationSec, loopWidth / speedPxPerSec);
  return {
    clipped: true,
    distancePx: -Math.round(loopWidth),
    durationSec: Math.round(durationSec * 100) / 100,
  };
}
