import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useThemeStore, type Theme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import { NotificationBell } from '../notifications/NotificationBell';
import { LoPoButton } from '../../LoPoButton';
import { TabBar } from './TabBar';

/**
 * ハウジング共通ヘッダー。
 * [ブランド] [TabBar] [通知 / テーマ / アバター]
 * 旧 TopBar からパネルトグル・breadcrumb を除き、中央に TabBar を据えた再構成。
 * (グローバル検索は死んだプレースホルダーだったため撤去。検索はフィルターパネルにある。)
 */
export const AppHeader: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const user = useAuthStore((s) => s.user);
  const profileAvatarUrl = useAuthStore((s) => s.profileAvatarUrl);
  const openLogin = useHousingModalStore((s) => s.openLogin);
  const openAccount = useHousingModalStore((s) => s.openAccount);

  // テーマ切替: 縦の「日没(上→下) / 日の出(下→上)」リビール (housing 限定・View Transitions)。
  // 参考: Akash Hamirwasia の全画面テーマトグル。data-theme-anim で CSS のワイプ向き +
  // シーナリー動画の即時差し替え (演出中は 700ms opacity を止める) を制御する。
  // 非対応ブラウザ / reduce-motion は即時切替。
  const switchTheme = (next: Theme) => {
    if (theme === next) return;
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };
    if (typeof doc.startViewTransition !== 'function' || reduce) {
      setTheme(next);
      return;
    }
    root.dataset.themeAnim = next; // 'dark'=日没(上→下) / 'light'=日の出(下→上)
    const transition = doc.startViewTransition(() => {
      // 「新」スナップショットに新テーマを確実に写すため flushSync で同期反映する。
      flushSync(() => setTheme(next));
    });
    transition.finished.finally(() => {
      delete root.dataset.themeAnim;
    });
  };

  return (
    <header className="housing-app-header" data-region="header">
      <div className="housing-brand-wrap">
        {/* 全アプリ共通の LoPo ロゴ (= miti と同一 LoPoButton)。ハウジングではハニーゴールド単色
            (ダーク/ライト共通)。色は housing トークンを var() で参照しハードコードを回避。 */}
        <LoPoButton size="sm" onClick={() => navigate('/')} color="var(--housing-honey)" />
        <span className="housing-brand-sub housing-brand-sub-standalone">
          {t('housing.workspace.topbar.subtitle')}
        </span>
      </div>

      <TabBar />

      <div className="housing-app-header-right">
        {user && <NotificationBell />}
        <div
          className="housing-theme-toggle"
          role="tablist"
          aria-label={t('housing.workspace.topbar.theme_toggle_label')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={theme === 'light'}
            className={theme === 'light' ? 'is-on' : ''}
            onClick={() => switchTheme('light')}
          >
            <span aria-hidden="true">☀</span>
            {t('housing.workspace.topbar.theme_light')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={theme === 'dark'}
            className={theme === 'dark' ? 'is-on' : ''}
            onClick={() => switchTheme('dark')}
          >
            <span aria-hidden="true">☾</span>
            {t('housing.workspace.topbar.theme_dark')}
          </button>
        </div>
        {user ? (
          <button
            type="button"
            className="housing-top-avatar-btn"
            onClick={() => openAccount()}
            aria-label={t('housing.topbar.account')}
          >
            {profileAvatarUrl ? (
              <img src={profileAvatarUrl} alt="" />
            ) : (
              <span className="housing-avatar-fallback">👤</span>
            )}
          </button>
        ) : (
          <button
            type="button"
            className="housing-top-login-btn"
            onClick={() => openLogin()}
          >
            {t('housing.topbar.login')}
          </button>
        )}
      </div>
    </header>
  );
};
