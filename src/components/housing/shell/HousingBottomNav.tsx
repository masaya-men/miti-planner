import { Fragment, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Heart, Route, Settings, User } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import { useNotifications } from '../notifications/useNotifications';

export interface HousingBottomNavProps {
  /** 設定シートを開く (HousingShell がローカル state で保持) */
  onOpenSettings: () => void;
}

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active: boolean;
  /** ログイン項目のみ: 未読通知があるとき true */
  badge?: boolean;
}

/**
 * スマホ用ボトムナビ (Task1: モバイルシェル基盤)。
 * 5項目: トップ / お気に入り / ツアー / 設定 / ログイン(orアカウント)。
 * 構造は src/components/MobileBottomNav.tsx を参考にしつつ、見た目は --housing-* トークンで独自トンマナに。
 * ツアー没入中 (HousingShell 側の immersive 判定) は呼び出し側で非表示にする。
 * 実機FB第2弾#2: 左端はフィルターでなくトップ(/housing へ)。フィルターはヘッダーへ移設 (AppHeader)。
 */
export const HousingBottomNav: React.FC<HousingBottomNavProps> = ({ onOpenSettings }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const profileAvatarUrl = useAuthStore((s) => s.profileAvatarUrl);
  const openLogin = useHousingModalStore((s) => s.openLogin);
  const openAccount = useHousingModalStore((s) => s.openAccount);
  // 未ログインでも呼んで良い (フック規則上、条件付き呼び出しはできない)。未ログイン時は
  // useNotifications 内部で購読が張られず unreadCount は常に 0 になる。
  const { unreadCount } = useNotifications();

  // 2026-07-24: ログイン中のアカウント項目は「マイページ」「アカウント設定」の2択メニューに。
  // 画面が狭くタブとして両方常設できないため、下部ナビでは1項目に集約する。
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!accountMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [accountMenuOpen]);

  const items: NavItem[] = [
    {
      id: 'home',
      icon: <Home size={20} aria-hidden="true" />,
      label: t('housing.mobile.nav_home'),
      onClick: () => navigate('/housing'),
      active: pathname === '/housing',
    },
    {
      id: 'favorites',
      icon: <Heart size={20} aria-hidden="true" />,
      label: t('housing.mobile.nav_favorites'),
      // 再タップ(既にそのページ)でベースの探すへ戻る (実機FB#2: 開いたページから同じボタンで帰れるように)。
      onClick: () =>
        navigate(pathname.startsWith('/housing/favorites') ? '/housing' : '/housing/favorites'),
      active: pathname.startsWith('/housing/favorites'),
    },
    {
      id: 'tour',
      icon: <Route size={20} aria-hidden="true" />,
      label: t('housing.mobile.nav_tour'),
      // 同上 (ツアー未開始でナビが見えている時に有効。ツアー実行中はナビ自体が没入で消える)。
      onClick: () =>
        navigate(pathname.startsWith('/housing/tour') ? '/housing' : '/housing/tour'),
      active: pathname.startsWith('/housing/tour'),
    },
    {
      id: 'settings',
      icon: <Settings size={20} aria-hidden="true" />,
      label: t('housing.mobile.nav_settings'),
      onClick: onOpenSettings,
      active: false,
    },
    {
      id: 'login',
      // 実機FB⑧: ログイン中は他画面のアバターボタン(AppHeader の .housing-top-avatar-btn)と
      // 同じ見た目(顔写真 or 頭文字絵文字)にする。従来は常に汎用の User アイコンのままで、
      // ログイン中でも「未ログイン」に見えていた。
      icon: user ? (
        profileAvatarUrl ? (
          <img src={profileAvatarUrl} alt="" className="housing-bottomnav-avatar" />
        ) : (
          <span className="housing-bottomnav-avatar housing-bottomnav-avatar-fallback" aria-hidden="true">
            👤
          </span>
        )
      ) : (
        <User size={20} aria-hidden="true" />
      ),
      label: user ? t('housing.topbar.account') : t('housing.mobile.nav_login'),
      onClick: () => (user ? setAccountMenuOpen((v) => !v) : openLogin()),
      active: false,
      badge: Boolean(user) && unreadCount > 0,
    },
  ];

  return (
    <nav className="housing-bottomnav" aria-label={t('housing.tabs.aria')}>
      {items.map((item) => {
        const itemButton = (
          <button
            type="button"
            className={`housing-bottomnav-item${item.active ? ' is-active' : ''}`}
            onClick={item.onClick}
            aria-current={item.active ? 'page' : undefined}
            aria-haspopup={item.id === 'login' && user ? 'menu' : undefined}
            aria-expanded={item.id === 'login' && user ? accountMenuOpen : undefined}
          >
            <span className="housing-bottomnav-icon">
              {item.icon}
              {item.badge && <span className="housing-bottomnav-badge" aria-hidden="true" />}
            </span>
            <span className="housing-bottomnav-label">{item.label}</span>
          </button>
        );

        // ログイン中のアカウント項目だけ「マイページ/アカウント設定」の2択ポップオーバーを持つ。
        if (item.id === 'login' && user) {
          return (
            <div key={item.id} className="housing-bottomnav-account" ref={accountMenuRef}>
              {itemButton}
              {accountMenuOpen && (
                <div role="menu" className="housing-bottomnav-account-menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      navigate('/housing/mypage');
                    }}
                  >
                    {t('housing.tabs.mypage')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      openAccount();
                    }}
                  >
                    {t('housing.topbar.account')}
                  </button>
                </div>
              )}
            </div>
          );
        }

        return <Fragment key={item.id}>{itemButton}</Fragment>;
      })}
    </nav>
  );
};
