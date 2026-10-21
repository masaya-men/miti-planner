import { useLayoutEffect, useState } from 'react';

/** テーマ切替は <html> の class で色(--ma-*)が変わる。class が変わるたびに増える数を返す(再描画の合図) */
export function useHtmlClassTick(): number {
  const [tick, setTick] = useState(0);
  useLayoutEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const mo = new MutationObserver(() => setTick((n) => n + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return tick;
}
