import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal, Heart, Route, Settings, User } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import { useNotifications } from '../notifications/useNotifications';

export interface HousingBottomNavProps {
  /** フィルターシートを開く (HousingShell がローカル state で保持) */
  onOpenFilter: () => void;
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
 * 5項目: フィルター / お気に入り / ツアー / 設定 / ログイン(orアカウント)。
 * 構造は src/components/MobileBottomNav.tsx を参考にしつつ、見た目は --housing-* トークンで独自トンマナに。
 * ツアー没入中 (HousingShell 側の immersive 判定) は呼び出し側で非表示にする。
 */
export const HousingBottomNav: React.FC<HousingBottomNavProps> = ({ onOpenFilter, onOpenSettings }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const openLogin = useHousingModalStore((s) => s.openLogin);
  const openAccount = useHousingModalStore((s) => s.openAccount);
  // 未ログインでも呼んで良い (フック規則上、条件付き呼び出しはできない)。未ログイン時は
  // useNotifications 内部で購読が張られず unreadCount は常に 0 になる。
  const { unreadCount } = useNotifications();

  const items: NavItem[] = [
    {
      id: 'filter',
      icon: <SlidersHorizontal size={20} aria-hidden="true" />,
      label: t('housing.mobile.nav_filter'),
      onClick: onOpenFilter,
      active: false,
    },
    {
      id: 'favorites',
      icon: <Heart size={20} aria-hidden="true" />,
      label: t('housing.mobile.nav_favorites'),
      onClick: () => navigate('/housing/favorites'),
      active: pathname.startsWith('/housing/favorites'),
    },
    {
      id: 'tour',
      icon: <Route size={20} aria-hidden="true" />,
      label: t('housing.mobile.nav_tour'),
      onClick: () => navigate('/housing/tour'),
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
      icon: <User size={20} aria-hidden="true" />,
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
