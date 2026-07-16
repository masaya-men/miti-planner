import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone } from 'lucide-react';

/** 純関数: 与えた window が縦持ちか。SSR/matchMedia 非対応では false(=ヒントを出さない安全側)。 */
function matchesPortrait(win: Pick<Window, 'matchMedia'> | undefined): boolean {
  if (!win || typeof win.matchMedia !== 'function') return false;
  return win.matchMedia('(orientation: portrait)').matches;
}

/**
 * スマホ縦持ち時のみ全画面に重ねる「端末を横にしてください」ヒント (Task4)。
 * `matchMedia('(orientation: portrait)')` を購読して向き変更に追随する。
 * 横持ちになった瞬間に自動で消える(閉じるボタンは無い=向きが正なので不要)。
 */
export const TourOrientationHint: React.FC = () => {
  const { t } = useTranslation();
  const [isPortrait, setIsPortrait] = useState<boolean>(() =>
    matchesPortrait(typeof window === 'undefined' ? undefined : window),
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(orientation: portrait)');
    const onChange = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    setIsPortrait(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (!isPortrait) return null;

  return (
    <div className="housing-tour-orientation-hint" role="status" data-testid="tour-orientation-hint">
      <Smartphone size={40} className="housing-tour-orientation-hint-icon" aria-hidden="true" />
      <p className="housing-tour-orientation-hint-text">{t('housing.mobile.rotate_hint')}</p>
    </div>
  );
};
