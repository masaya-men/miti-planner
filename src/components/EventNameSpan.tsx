import React from 'react';
import clsx from 'clsx';
import { Tooltip } from './ui/Tooltip';
import { computeMarqueeMetrics, type MarqueeMetrics } from '../utils/marquee';

/** 攻撃名スパン。
 *  - 見切れ時のみ: 行(group)ホバーで内側テキストが1往復マーキー / 名前ホバーでツールチップ(排他)。
 *  - 見切れ判定とスライド距離は ResizeObserver(マウント/リサイズ時)で計測し data-clipped + CSS 変数に反映。
 *    perf #59: onMouseEnter 毎の scrollWidth 読みは forced reflow になるため禁止。hover 時は CSS 参照のみ。 */
export const EventNameSpan: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
    const clipRef = React.useRef<HTMLSpanElement>(null);
    const textRef = React.useRef<HTMLSpanElement>(null);
    const [metrics, setMetrics] = React.useState<MarqueeMetrics>({ clipped: false, distancePx: 0, durationSec: 0 });

    React.useEffect(() => {
        const clip = clipRef.current;
        const text = textRef.current;
        if (!clip || !text) return;
        const measure = () => setMetrics(computeMarqueeMetrics(text.scrollWidth, clip.clientWidth));
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(clip);
        return () => ro.disconnect();
    }, [name]);

    return (
        <Tooltip content={metrics.clipped ? name : ''} wrapperClassName="!w-auto min-w-0">
            <span
                ref={clipRef}
                data-clipped={metrics.clipped ? '' : undefined}
                className="lopo-name-clip block min-w-0 overflow-hidden"
                style={metrics.clipped ? ({
                    '--marquee-distance': `${metrics.distancePx}px`,
                    '--marquee-duration': `${metrics.durationSec}s`,
                } as React.CSSProperties) : undefined}
            >
                <span
                    ref={textRef}
                    className={clsx(className, 'lopo-name-text block truncate font-black text-app-text leading-none pt-0.5')}
                >
                    {name}
                </span>
            </span>
        </Tooltip>
    );
};
