/**
 * Phase 3: TopBar に置く通知ベル + ドロップダウン制御
 *
 * - 未読件数バッジ (9 件超は 9+)
 * - クリックで Dropdown 開閉、 外側クリックで閉じる
 * - aria-label は i18n キー経由
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from './useNotifications';
import { NotificationDropdown } from './NotificationDropdown';

export const NotificationBell: React.FC = () => {
  const { t } = useTranslation();
  const { items, unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const badge = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <div className="housing-notif-bell" ref={ref}>
      <button
        type="button"
        aria-label={t('housing.notifications.bell_aria')}
        className="housing-notif-bell-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2C8.13 2 5 5.13 5 9v5l-2 2v1h18v-1l-2-2V9c0-3.87-3.13-7-7-7zm0 20a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2z"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            className="housing-notif-badge"
            aria-label={t('housing.notifications.unread_badge_aria', { n: unreadCount })}
          >
            {badge}
          </span>
        )}
      </button>
      {open && (
        <NotificationDropdown
          items={items}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};
