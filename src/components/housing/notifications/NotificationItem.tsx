/**
 * Phase 3: 通知 1 件のリスト項目
 *
 * - `<Link>` で listing 詳細モーダルへ遷移 (background-location パターン)
 * - URL クエリ `?notification=<id>` を付与し、 詳細ルート側でガイドモーダルを開く
 * - 未読ドット + 相対時刻表示
 */
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import type { HousingNotification } from '../../../types/notification';

function formatRelativeTime(t: TFunction, ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return t('housing.notifications.time.just_now');
  const min = Math.floor(sec / 60);
  if (min < 60) return t('housing.notifications.time.minutes_ago', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('housing.notifications.time.hours_ago', { n: hr });
  const day = Math.floor(hr / 24);
  return t('housing.notifications.time.days_ago', { n: day });
}

export interface NotificationItemProps {
  notification: HousingNotification;
  onClick?: (n: HousingNotification) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClick,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const reasonLabel = t(`housing.report.reason.${notification.reason}`);
  const msg = t('housing.notifications.item.report', {
    title: notification.listingTitleSnapshot ?? '',
    reason: reasonLabel,
  });
  return (
    <Link
      to={`/housing/listing/${notification.listingId}?notification=${notification.id}`}
      state={{ backgroundLocation: location }}
      className={`housing-notif-item${notification.read ? '' : ' unread'}`}
      onClick={() => onClick?.(notification)}
    >
      {!notification.read && <span className="housing-notif-dot" aria-hidden="true" />}
      <span className="housing-notif-msg">{msg}</span>
      <span className="housing-notif-time">
        {formatRelativeTime(t, notification.createdAt)}
      </span>
    </Link>
  );
};
