import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useThemeStore } from '../../store/useThemeStore';
import { useTransitionOverlay } from '../ui/TransitionOverlay';

interface Props {
  /** モバイルヘッダー等・小さめ表示 */
  compact?: boolean;
  className?: string;
}

/** テーマの「スタイル軸」を standard ⇄ military で切り替える専用ボタン。
 *  明るさ軸(Sun/Moon)とは独立。ヘッダー / モバイルヘッダー / FAB から使う。 */
export const MilspecStyleToggle: React.FC<Props> = ({ compact = false, className }) => {
  const { t } = useTranslation();
  const themeStyle = useThemeStore((s) => s.themeStyle);
  const setThemeStyle = useThemeStore((s) => s.setThemeStyle);
  const { runTransition } = useTransitionOverlay();
  const isMil = themeStyle === 'military';
  const size = compact ? 14 : 16;

  return (
    <button
      type="button"
      aria-pressed={isMil}
      aria-label={isMil ? t('app.theme_style_to_standard') : t('app.theme_style_to_milspec')}
      title={isMil ? t('app.theme_style_to_standard') : t('app.theme_style_to_milspec')}
      onClick={() => runTransition(() => setThemeStyle(isMil ? 'standard' : 'military'), 'theme')}
      className={clsx(
        'group flex items-center justify-center transition-colors cursor-pointer',
        className,
      )}
    >
      {/* 六角ボルト + ブラケットの簡易アイコン。military のときはアクティブ色。 */}
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
           className={clsx(isMil ? 'text-app-accent' : 'text-app-text-muted group-hover:text-app-text')}>
        <path d="M3 3h4M3 3v4M21 3h-4M21 3v4M3 21h4M3 21v-4M21 21h-4M21 21v-4" />
        <path d="M12 8.5l3 1.75v3.5L12 15.5l-3-1.75v-3.5z" />
      </svg>
    </button>
  );
};
