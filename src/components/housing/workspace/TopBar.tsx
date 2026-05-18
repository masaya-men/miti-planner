import { useTranslation } from 'react-i18next';
import { Heart, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Search } from 'lucide-react';
import { useThemeStore } from '../../../store/useThemeStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';

export interface TopBarProps {
    onFavoritesClick?: () => void;
    onRegisterClick?: () => void;
}

/**
 * TopBar — mockup-faithful header.
 * Layout:
 *   [left-panel toggle] [brand mark + LoPo / Housing Tour]
 *   [breadcrumb]
 *   [♡ favorites] [theme toggle pill] [right-panel toggle]
 *
 * Panel toggles live here (rather than as floating handles) so that the spec
 * "両方閉じれば中央エリアが全幅" is preserved — once a panel is collapsed it
 * leaves no rail/handle behind, and re-opening goes through the TopBar.
 */
export const TopBar: React.FC<TopBarProps> = ({ onFavoritesClick, onRegisterClick }) => {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const leftPanelOpen = useHousingViewStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useHousingViewStore((s) => s.rightPanelOpen);
  const setLeftPanelOpen = useHousingViewStore((s) => s.setLeftPanelOpen);
  const setRightPanelOpen = useHousingViewStore((s) => s.setRightPanelOpen);
  const mode = useHousingViewStore((s) => s.mode);
  const favoritesCount = useHousingFavoritesStore((s) => s.ids.length);
  const searchText = useHousingFilterStore((s) => s.searchText);
  const setSearchText = useHousingFilterStore((s) => s.setSearchText);

  const LeftIcon = leftPanelOpen ? PanelLeftClose : PanelLeftOpen;
  const RightIcon = rightPanelOpen ? PanelRightClose : PanelRightOpen;
  const leftLabel = leftPanelOpen
    ? t('housing.workspace.panel.close_left')
    : t('housing.workspace.panel.open_left');
  const rightLabel = rightPanelOpen
    ? t('housing.workspace.panel.close_right')
    : t('housing.workspace.panel.open_right');
  // §3.3: ツアー中は右パネルを閉じられない (進行表示のため固定)
  const rightDisabled = mode === 'tour' && rightPanelOpen;

  return (
    <header className="housing-top">
      <div className="housing-top-left">
        <button
          type="button"
          className="housing-panel-toggle"
          aria-label={leftLabel}
          aria-pressed={leftPanelOpen}
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
        >
          <LeftIcon size={18} aria-hidden="true" />
        </button>
        <div
          className="housing-brand"
          role="img"
          aria-label={t('housing.workspace.topbar.logo_alt')}
        >
          <span className="housing-brand-mark" aria-hidden="true" />
          <span>
            LoPo&nbsp;
            <span className="housing-brand-sub">/ {t('housing.workspace.topbar.subtitle')}</span>
          </span>
        </div>
        <div className="housing-top-search">
          <span className="housing-top-search-icon" aria-hidden="true">
            <Search size={14} />
          </span>
          <input
            type="text"
            className="housing-top-search-input"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('housing.workspace.topbar.search_placeholder')}
            aria-label={t('housing.workspace.topbar.search_placeholder')}
          />
        </div>
      </div>

      <nav className="housing-crumbs" aria-label={t('housing.workspace.topbar.breadcrumb_label')}>
        {/* TODO(Plan C): replace with selected DC / region / ward / plot from state. */}
        <span className="now">{t('housing.workspace.topbar.browse_placeholder')}</span>
      </nav>

      <div className="housing-top-right">
        {onFavoritesClick && (
          <button
            type="button"
            onClick={onFavoritesClick}
            aria-label={t('housing.workspace.topbar.favorites')}
            className="housing-favorites-toggle"
          >
            <Heart size={16} aria-hidden="true" />
            {favoritesCount > 0 && (
              <span className="housing-favorites-toggle-badge">{favoritesCount}</span>
            )}
          </button>
        )}
        {onRegisterClick && (
          <button
            type="button"
            onClick={onRegisterClick}
            className="housing-top-register-btn"
          >
            {t('housing.workspace.topbar.register')}
          </button>
        )}
        <div className="housing-theme-toggle" role="tablist" aria-label={t('housing.workspace.topbar.theme_toggle_label')}>
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
        <button
          type="button"
          className="housing-panel-toggle"
          aria-label={rightLabel}
          aria-pressed={rightPanelOpen}
          disabled={rightDisabled}
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
        >
          <RightIcon size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};
