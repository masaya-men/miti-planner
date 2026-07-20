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
      onClick: () => (user ? openAccount() : openLogin()),
      active: false,
      badge: Boolean(user) && unreadCount > 0,
    },
  ];

  return (
    <nav className="housing-bottomnav" aria-label={t('housing.tabs.aria')}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`housing-bottomnav-item${item.active ? ' is-active' : ''}`}
          onClick={item.onClick}
          aria-current={item.active ? 'page' : undefined}
        >
          <span className="housing-bottomnav-icon">
            {item.icon}
            {item.badge && <span className="housing-bottomnav-badge" aria-hidden="true" />}
          </span>
          <span className="housing-bottomnav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};
