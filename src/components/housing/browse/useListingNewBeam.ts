import { useEffect, useRef, useState } from 'react';

/**
 * ListingCard の NEW ビーム演出: カードが画面内に入った回数 (enterCount) を数える。
 */
export function useListingNewBeam(isNew: boolean) {
  // ビーム演出はマウント直後ではなく、実際にスクロールして画面内に入るたびに1周だけ再生する
  // (2026-08-16 実機指摘: 全カードが一度にDOM化されるため、マウント基準だと画面外のカードが
  // 見えないまま光り終わっていた。さらに2026-08-16 追加要望: 画面外に出てまた入ってきた時にも
  // 再度光ってほしい)。リボン自体 (isNew) は静的表示なので画面内に入るのを待たず即座に出す。
  // enterCount を「画面内に入った回数」として増やし、それを beam span の key にすることで、
  // React に毎回そのDOM要素を作り直させ (再マウント)、CSSアニメーションを確実に最初から
  // 再生させる (クラスの再付与だけでは既に走り終えたCSSアニメーションは再始動しないため)。
  const [enterCount, setEnterCount] = useState(0);
  const wasIntersectingRef = useRef(false);
  const cardElRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isNew) return;
    const el = cardElRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !wasIntersectingRef.current) {
          wasIntersectingRef.current = true;
          setEnterCount((c) => c + 1);
        } else if (!entry.isIntersecting) {
          wasIntersectingRef.current = false;
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isNew]);
  return { enterCount, cardElRef };
}
