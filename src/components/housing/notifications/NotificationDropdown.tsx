/**
 * Phase 3: 通知ドロップダウン (ベル押下で開く)
 *
 * - 最新 5 件 + ヘッダー (タイトル + 「すべて既読にする」) + フッター (「すべて見る」)
 * - フッターはまだ実装無し、 i18n キーに `coming_soon` を併記して disabled 表示
 */
import { useTranslation } from 'react-i18next';
import { NotificationItem } from './NotificationItem';
import type { HousingNotification } from '../../../types/notification';

export interface NotificationDropdownProps {
  items: HousingNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  items,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClose,
}) => {
  const { t } = useTranslation();
  const top5 = items.slice(0, 5);
  return (
    <div role="menu" className="housing-notif-dropdown">
      <header className="housing-notif-dropdown-header">
        <h3>{t('housing.notifications.title')}</h3>
        {unreadCount > 0 && (
          <button type="button" onClick={onMarkAllRead}>
            {t('housing.notifications.mark_all_read')}
          </button>
        )}
      </header>
      {top5.length === 0 ? (
        <p className="housing-notif-empty">{t('housing.notifications.empty')}</p>
      ) : (
        <ul className="housing-notif-list">
          {top5.map((n) => (
            <li key={n.id}>
              <NotificationItem
                notification={n}
                onClick={(nn) => {
                  onMarkRead(nn.id);
                  onClose();
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <footer className="housing-notif-dropdown-footer">
        <span aria-disabled="true">
          {t('housing.notifications.see_all')} ({t('housing.notifications.see_all_coming_soon')})
        </span>
      </footer>
    </div>
  );
};
