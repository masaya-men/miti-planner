import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 各カード ref の visibility ratio を IntersectionObserver で集計する。
 * register(id, el) / unregister(id) を子コンポーネント (HousingCard) から呼ぶ。
 * 1 個の observer で全カードを監視、 thresholds は 0..1 を 11 段階。
 *
 * 戻り値 visibility は Map<id, ratio> で、 各 entry は IO callback が更新する。
 */
export function useViewportPlaybackPool(): {
  visibility: ReadonlyMap<string, number>;
  register: (id: string, el: Element) => void;
  unregister: (id: string) => void;
} {
  const [visibility, setVisibility] = useState<ReadonlyMap<string, number>>(new Map());
  const elToId = useRef<Map<Element, string>>(new Map());
  const idToEl = useRef<Map<string, Element>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisibility((prev) => {
          const next = new Map(prev);
          for (const entry of entries) {
            const id = elToId.current.get(entry.target);
            if (!id) continue;
            next.set(id, entry.intersectionRatio);
          }
          return next;
        });
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] },
    );
    observerRef.current = observer;
    // 既存登録分があれば observe (StrictMode の二重 mount 対策)
    for (const el of idToEl.current.values()) observer.observe(el);
    return (): void => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  const register = useCallback((id: string, el: Element) => {
    const prevEl = idToEl.current.get(id);
    if (prevEl === el) return;
    if (prevEl) {
      elToId.current.delete(prevEl);
      observerRef.current?.unobserve(prevEl);
    }
    idToEl.current.set(id, el);
    elToId.current.set(el, id);
    observerRef.current?.observe(el);
  }, []);

  const unregister = useCallback((id: string) => {
    const el = idToEl.current.get(id);
    if (!el) return;
    elToId.current.delete(el);
    idToEl.current.delete(id);
    observerRef.current?.unobserve(el);
    setVisibility((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return { visibility, register, unregister };
}
