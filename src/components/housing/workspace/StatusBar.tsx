import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../../store/useThemeStore';
import { KOFI_URL } from '../../../constants/external';

const LANGS = ['ja', 'en', 'ko', 'zh'] as const;

// 実行中コードの版 (短 git SHA)。vite.config.ts の define で build 時に注入される。
// UI 表示は 2026-07-10 に撤去したが、旧 Service Worker / PWA が旧バンドルを配信していないかの
// 現地診断計器としての価値は残すため、シェル起動時に console へ 1 回だけ出す。
declare const __HOUSING_BUILD__: string;
const BUILD_VERSION = typeof __HOUSING_BUILD__ !== 'undefined' ? __HOUSING_BUILD__ : 'v0.3-α';

/**
 * StatusBar — フッター (2026-07-10 刷新)。
 * 左: © LoPo + プライバシーポリシー / 利用規約 / Ko-fi (すべて別タブ)
 * 右: テーマ表示 · 言語スイッチャー
 *
 * BUILD / LAT・LON / STOPS / FPS のダミー数値表示は撤去。BUILD の診断価値は
 * console.info 出力に残す (StatusBar は housing シェルに 1 度だけマウントされる)。
 */
export const StatusBar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info('[housing] build', BUILD_VERSION);
  }, []);

  const themeLabel = theme === 'light'
    ? t('housing.workspace.topbar.theme_light')
    : t('housing.workspace.topbar.theme_dark');

  return (
    <footer className="housing-status">
      <div className="housing-status-group housing-status-legal">
        <span>{t('footer.copyright')}</span>
        <span className="housing-status-disclaimer">{t('footer.disclaimer')}</span>
        <a href="/privacy" target="_blank" rel="noopener">
          {t('footer.privacy_policy')}
        </a>
        <a href="/terms" target="_blank" rel="noopener">
          {t('footer.terms')}
        </a>
        <a href={KOFI_URL} target="_blank" rel="noopener noreferrer">
          {t('footer.kofi')}
        </a>
      </div>

      <div className="housing-status-group">
        <span>
          {t('housing.workspace.statusbar.theme_readout_label')}&nbsp;
          <span className="housing-accent">{themeLabel}</span>
        </span>
        <span className="housing-status-lang">
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
        </span>
      </div>
    </footer>
  );
};
