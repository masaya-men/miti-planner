import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeStore, type Theme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';
import { searchPersonalTags } from '../../../lib/personalTagApiClient';
import type { PersonalTag } from '../../../types/housing';
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

  // 横断検索は探すページ (/housing の index) のみ表示。keyword は filter store 管理。
  const location = useLocation();
  const showSearch = location.pathname === '/housing';
  const keyword = useHousingFilterStore((s) => s.keyword);
  const setKeyword = useHousingFilterStore((s) => s.setKeyword);
  const toggleTag = useHousingFilterStore((s) => s.toggleTag);
  const [housingerHits, setHousingerHits] = useState<PersonalTag[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ハウジンガー名の候補取得 (探すページのみ・PersonalTagFilter と同じ 300ms debounce)。
  useEffect(() => {
    if (!showSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = keyword.trim();
    if (q.length === 0) {
      setHousingerHits([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchPersonalTags(q)
        .then((tags) => setHousingerHits(tags.slice(0, 5)))
        .catch(() => setHousingerHits([]));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [keyword, showSearch]);

  // 検索窓の外側クリックで候補ドロップダウンを閉じる。
  useEffect(() => {
    if (!dropdownOpen) return;
    const onDown = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dropdownOpen]);

  return (
    <header className="housing-app-header" data-region="header">
      <div className="housing-app-header-left">
      <div className="housing-brand-wrap">
        {/* 全アプリ共通の LoPo ロゴ (= miti と同一 LoPoButton)。ハウジングではハニーゴールド単色
            (ダーク/ライト共通)。色は housing トークンを var() で参照しハードコードを回避。 */}
        <LoPoButton size="sm" onClick={() => navigate('/')} color="var(--housing-honey)" />
        <span className="housing-brand-sub housing-brand-sub-standalone">
          {t('housing.workspace.topbar.subtitle')}
        </span>
      </div>

      {showSearch && (
        <div className="housing-app-search" ref={searchWrapRef}>
          <input
            type="search"
            className="housing-input housing-app-search-input"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            placeholder={t('housing.header.search_placeholder')}
            aria-label={t('housing.header.search_placeholder')}
          />
          {dropdownOpen && keyword.trim().length > 0 && housingerHits.length > 0 && (
            <div className="housing-app-search-dropdown">
              <div className="housing-app-search-dropdown-head">
                {t('housing.header.search_housingers')}
              </div>
              {housingerHits.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="housing-app-search-housinger"
                  onClick={() => {
                    toggleTag(tag.id);
                    setDropdownOpen(false);
                  }}
                >
                  {t('housing.header.search_view_homes', { name: tag.displayName })}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
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
