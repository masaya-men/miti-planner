import React from 'react';
import { computeMarqueeLoopMetrics, type MarqueeMetrics } from '../../../utils/marquee';

/**
 * カードキャプション用の1行ループマーキー。
 * 見切れている時だけ内容を2連にして、カードホバー中に
 * 「あいうえお　　あいうえお　　…」とゆっくり左へ流れ続ける (静かなティッカー)。
 * 計測は ResizeObserver で行い、hover 時は CSS 変数参照のみ
 * (onMouseEnter での scrollWidth 読みは forced reflow になるため禁止・perf #59 と同じ方針)。
 * アニメーション発火はカード側の :hover セレクタ (housing.css) が担う。
 */
export const HousingCardMarqueeLine: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const clipRef = React.useRef<HTMLDivElement>(null);
  const copyRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLSpanElement>(null);
  const [metrics, setMetrics] = React.useState<MarqueeMetrics>({
    clipped: false,
    distancePx: 0,
    durationSec: 0,
  });

  React.useEffect(() => {
    const clip = clipRef.current;
    const copy = copyRef.current;
    const content = contentRef.current;
    if (!clip || !copy || !content) return;
    const measure = () =>
      setMetrics(
        // content=テキスト本体 (見切れ判定) / copy=テキスト+コピー間ギャップ (1周距離)
        computeMarqueeLoopMetrics(content.offsetWidth, copy.offsetWidth, clip.clientWidth),
      );
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(clip);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div
      ref={clipRef}
      data-clipped={metrics.clipped ? '' : undefined}
      className={`housing-marquee-clip${className ? ` ${className}` : ''}`}
      style={
        metrics.clipped
          ? ({
              '--marquee-distance': `${metrics.distancePx}px`,
              '--marquee-duration': `${metrics.durationSec}s`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className="housing-marquee-track">
        <div ref={copyRef} className="housing-marquee-copy">
          <span ref={contentRef}>{children}</span>
        </div>
        {metrics.clipped && (
          <div className="housing-marquee-copy" aria-hidden="true">
            <span>{children}</span>
          </div>
        )}
      </div>
    </div>
  );
};
