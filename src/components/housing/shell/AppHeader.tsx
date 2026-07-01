import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import { NotificationBell } from '../notifications/NotificationBell';
import { LoPoButton } from '../../LoPoButton';
import { TabBar } from './TabBar';

/**
 * ハウジング共通ヘッダー。
 * [ブランド] [グローバル検索] [TabBar] [通知 / テーマ / アバター]
 * 旧 TopBar からパネルトグル・breadcrumb を除き、中央に TabBar を据えた再構成。
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

      {/* グローバル検索: 第1スパンは見た目のみ (探すのフィルタ store への接続は後続)。 */}
      <div className="housing-app-search">
        <input
          type="search"
          className="housing-app-search-input"
          placeholder={t('housing.header.search_placeholder')}
          aria-label={t('housing.header.search_placeholder')}
        />
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
            onClick={() => setTheme('light')}
          >
            <span aria-hidden="true">☀</span>
            {t('housing.workspace.topbar.theme_light')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={theme === 'dark'}
            className={theme === 'dark' ? 'is-on' : ''}
            onClick={() => setTheme('dark')}
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
