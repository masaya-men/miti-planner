import React from 'react';
import { computeMarqueeLoopMetrics, type MarqueeMetrics } from '../../../utils/marquee';
import './HousingCardMarqueeLine.css';

/**
 * カードキャプション用の1行ループマーキー。
 * 見切れている時だけ内容を2連にして、カードホバー中に
 * 「あいうえお\u3000\u3000あいうえお\u3000\u3000…」とゆっくり左へ流れ続ける (静かなティッカー)。
 * 計測は ResizeObserver で行い、hover 時は CSS 変数参照のみ
 * (onMouseEnter での scrollWidth 読みは forced reflow になるため禁止・perf #59 と同じ方針)。
 * アニメーション発火はカード側の :hover セレクタ (HousingCardMarqueeLine.css) が担う。
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
    // 計測は ResizeObserver の通知の中だけで行う (通知は配置計算の後に来るので、幅を読んでも
    // 配置計算のやり直しにならない)。以前はマウント直後に同期で測っていて、探すページの
    // 約 274 枚で 1 枚ごとに配置計算がやり直され、約 2 秒画面が止まっていた (2026-10-22 本番実測)。
    // 幅 0 の通知 = 画面外で配置が省略されている (content-visibility:auto) カードなので測らない
    // (ここで幅を読むと、そのカードの配置計算を強制してしまう)。画面に近づくと改めて通知が来る。
    const ro = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width === 0) return;
      // content=テキスト本体 (見切れ判定) / copy=テキスト+コピー間ギャップ (1周距離)
      const next = computeMarqueeLoopMetrics(content.offsetWidth, copy.offsetWidth, clip.clientWidth);
      setMetrics((prev) =>
        prev.clipped === next.clipped && prev.distancePx === next.distancePx && prev.durationSec === next.durationSec
          ? prev
          : next,
      );
    });
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
