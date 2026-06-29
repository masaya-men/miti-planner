import { useEffect, useState } from 'react';

/** スマホ幅の境界。Tailwind の md(768px) 未満をスマホ扱い。 */
export const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

/** 純関数: 与えた window がスマホ幅か。SSR/matchMedia 非対応では false。 */
export function matchesMobile(win: Pick<Window, 'matchMedia'> | undefined): boolean {
  if (!win || typeof win.matchMedia !== 'function') return false;
  return win.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

/** スマホ幅(<768px)かを返すフック。リサイズ/回転に追従。 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    matchesMobile(typeof window === 'undefined' ? undefined : window),
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
