import { useCallback, useRef } from 'react';
import { useSlideshowCycle } from '../../../lib/housing/useSlideshowCycle';
import type { SlideshowFrame } from '../../../lib/housing/slideshowFrames';
import { slideshowWindowIndices } from '../../../lib/housing/slideshowWindow';
import { cardImageAttrs, CARD_IMAGE_SIZES } from '../../../lib/housing/cardImageAttrs';

export interface HousingCardAmbientSlideshowProps {
  /** 表示する静止画フレーム (resolveSlideshowFrames の戻り値)。 */
  frames: readonly SlideshowFrame[];
  /** false なら静止 (= スクロール中 / reduced-motion / lightbox open)。 */
  enabled: boolean;
}

/**
 * カードの上に重ねる静止画クロスフェードレイヤー。 各カード独立にランダム間隔で
 * 次のフレームへ。 1 枚しか無いカードは静止、 0 枚なら何も描画しない。
 * pointer-events: none で背後のカード操作 (クリック → Lightbox) を妨げない。
 */
export function HousingCardAmbientSlideshow({
  frames,
  enabled,
}: HousingCardAmbientSlideshowProps): React.ReactElement | null {
  const index = useSlideshowCycle(frames.length, enabled);
  const swappedRef = useRef<Set<number>>(new Set());

  const handleError = useCallback(
    (i: number) =>
      (e: React.SyntheticEvent<HTMLImageElement>): void => {
        const fallback = frames[i]?.fallback;
        if (!fallback) return;
        if (swappedRef.current.has(i)) return;
        swappedRef.current.add(i);
        e.currentTarget.srcset = '';
        e.currentTarget.src = fallback;
      },
    [frames],
  );

  if (frames.length === 0) return null;

  const windowSet = new Set(slideshowWindowIndices(frames.length, index));

  return (
    <div className="housing-card-ambient-slideshow" aria-hidden="true">
      {frames.map((f, i) => {
        if (!windowSet.has(i)) return null;
        const a = cardImageAttrs(f.src, { sizes: CARD_IMAGE_SIZES, twitterName: 'small' });
        return (
          <img
            key={`${i}-${f.src}`}
            src={a.src}
            srcSet={a.srcSet}
            sizes={a.sizes}
            alt=""
            role="presentation"
            loading="lazy"
            decoding="async"
            data-active={i === index}
            onError={handleError(i)}
          />
        );
      })}
    </div>
  );
}
