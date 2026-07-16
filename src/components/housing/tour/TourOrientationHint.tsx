import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone } from 'lucide-react';

/** 純関数: 与えた window が縦持ちか。SSR/matchMedia 非対応では false(=ヒントを出さない安全側)。 */
function matchesPortrait(win: Pick<Window, 'matchMedia'> | undefined): boolean {
  if (!win || typeof win.matchMedia !== 'function') return false;
  return win.matchMedia('(orientation: portrait)').matches;
}

/** ヒントの自動消滅までの表示時間 (ms)。実機FB#6: 数秒見せるだけ・回転は強制しない。 */
const HINT_DURATION_MS = 4000;

/**
 * スマホ縦持ち時に数秒だけ重ねる「端末を横にしてください」ヒント (Task4 → 実機FB#6 で緩和)。
 * 回転を強制せず (操作は pointer-events:none でブロックしない)、HINT_DURATION_MS 経過で
 * 自動的に消える。縦のままでも横想定 UI をそのまま使える。横持ちで開いた場合は最初から出ない。
 */
export const TourOrientationHint: React.FC = () => {
  const { t } = useTranslation();
  const [isPortrait, setIsPortrait] = useState<boolean>(() =>
    matchesPortrait(typeof window === 'undefined' ? undefined : window),
  );
  // マウントから一定時間で消えたまま戻さない (向きを変えるたびに再表示しない)。
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(orientation: portrait)');
    const onChange = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    setIsPortrait(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setExpired(true), HINT_DURATION_MS);
    return () => clearTimeout(id);
  }, []);

  if (!isPortrait || expired) return null;

  return (
    <div className="housing-tour-orientation-hint" role="status" data-testid="tour-orientation-hint">
      <Smartphone size={40} className="housing-tour-orientation-hint-icon" aria-hidden="true" />
      <p className="housing-tour-orientation-hint-text">{t('housing.mobile.rotate_hint')}</p>
    </div>
  );
};
