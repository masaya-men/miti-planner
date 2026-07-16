import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { MobileBottomSheet } from '../../MobileBottomSheet';
import { useThemeStore } from '../../../store/useThemeStore';

export interface HousingSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const LANGS = ['ja', 'en', 'ko', 'zh'] as const;

/**
 * スマホ用設定シート (Task1: モバイルシェル基盤)。
 * 旧フッター (StatusBar.tsx) の中身を移植: テーマ切替 / 言語スイッチャー / 法的リンク。
 * StatusBar 自体は housing.css の @media (max-width:767px) で非表示にし、ここに一本化する。
 * (AppHeader の switchTheme にある View Transitions 演出はここでは省略・簡易切替でよい方針)
 */
export const HousingSettingsSheet: React.FC<HousingSettingsSheetProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  // 実機FB#3: フィルターシートと同じく housing トンマナ化 (自前ヘッダー + className)。
  return (
    <MobileBottomSheet isOpen={isOpen} onClose={onClose} className="housing-mobile-sheet">
      <div className="housing-sheet-head">
        <span className="housing-sheet-title">{t('housing.mobile.settings_title')}</span>
        <button
          type="button"
          className="housing-sheet-close"
          onClick={onClose}
          aria-label={t('housing.card.close')}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="housing-mobile-settings-section">
        <h4 className="housing-mobile-settings-label">{t('housing.mobile.settings_theme')}</h4>
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
      </div>

      <div className="housing-mobile-settings-section">
        <h4 className="housing-mobile-settings-label">{t('housing.mobile.settings_language')}</h4>
        <div className="housing-status-lang">
          {LANGS.map((lang) => {
            const isActive = i18n.language === lang || i18n.language.startsWith(`${lang}-`);
            return (
              <button
                key={lang}
                type="button"
                aria-pressed={isActive}
                className={isActive ? 'is-on' : ''}
                onClick={() => i18n.changeLanguage(lang)}
              >
                {lang}
              </button>
            );
          })}
        </div>
      </div>

      <div className="housing-status-group housing-status-legal housing-mobile-settings-legal">
        <span>{t('footer.copyright')}</span>
        <a href="/privacy" target="_blank" rel="noopener">
          {t('footer.privacy_policy')}
        </a>
        <a href="/terms" target="_blank" rel="noopener">
          {t('footer.terms')}
        </a>
        <Link to="/support" onClick={onClose}>
          {t('footer.kofi')}
        </Link>
      </div>
    </MobileBottomSheet>
  );
};
