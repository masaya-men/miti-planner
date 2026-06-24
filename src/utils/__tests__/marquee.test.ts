import { describe, it, expect } from 'vitest';
import { computeMarqueeMetrics } from '../marquee';

describe('computeMarqueeMetrics', () => {
  it('テキストがクリップ窓に収まる → clipped=false・全0', () => {
    expect(computeMarqueeMetrics(100, 200)).toEqual({ clipped: false, distancePx: 0, durationSec: 0 });
  });

  it('同幅(はみ出し0) → clipped=false', () => {
    expect(computeMarqueeMetrics(100, 100)).toEqual({ clipped: false, distancePx: 0, durationSec: 0 });
  });

  it('はみ出しあり → clipped=true・距離は負・所要時間を算出', () => {
    // overflow=100 → 100/40/0.35 = 7.142… → [1.2,8] 内 → 7.14
    expect(computeMarqueeMetrics(200, 100)).toEqual({ clipped: true, distancePx: -100, durationSec: 7.14 });
  });

  it('はみ出し大 → durationSec は上限8でクランプ', () => {
    // overflow=900 → 900/40/0.35=64.2… → 8 にクランプ
    expect(computeMarqueeMetrics(1000, 100)).toEqual({ clipped: true, distancePx: -900, durationSec: 8 });
  });

  it('はみ出し極小 → durationSec は下限1.2でクランプ', () => {
    // overflow=5 → 5/40/0.35=0.357 → 1.2 にクランプ
    expect(computeMarqueeMetrics(105, 100)).toEqual({ clipped: true, distancePx: -5, durationSec: 1.2 });
  });

  it('opts で速度・割合・上下限を上書きできる', () => {
    // overflow=100 → 100/100/0.5=2 → [0,100] 内 → 2
    expect(
      computeMarqueeMetrics(200, 100, { speedPxPerSec: 100, motionFraction: 0.5, minDurationSec: 0, maxDurationSec: 100 }),
    ).toEqual({ clipped: true, distancePx: -100, durationSec: 2 });
  });
});
