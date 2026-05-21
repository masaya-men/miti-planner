/**
 * Phase 3: 通知ドロップダウン (ベル押下で開く)
 *
 * - 最新 5 件 + ヘッダー (タイトル) + フッター (「すべて見る」)
 * - 通報通知は「読んだだけ / 一括既読」 では消さない方針のため、 一括既読ボタンは置かない。
 *   既読 (=解決) は物件詳細の案内バナーのアクションで行う。
 * - 項目クリックで詳細モーダル (案内バナー付き) へ遷移し、 ドロップダウンを閉じる。
 * - フッターはまだ実装無し、 i18n キーに `coming_soon` を併記して disabled 表示
 */
import { useTranslation } from 'react-i18next';
import { NotificationItem } from './NotificationItem';
import type { HousingNotification } from '../../../types/notification';

export interface NotificationDropdownProps {
  items: HousingNotification[];
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  items,
  onClose,
}) => {
  const { t } = useTranslation();
  const top5 = items.slice(0, 5);
  return (
    <div role="menu" className="housing-notif-dropdown">
      <header className="housing-notif-dropdown-header">
        <h3>{t('housing.notifications.title')}</h3>
      </header>
      {top5.length === 0 ? (
        <p className="housing-notif-empty">{t('housing.notifications.empty')}</p>
      ) : (
        <ul className="housing-notif-list">
          {top5.map((n) => (
            <li key={n.id}>
              <NotificationItem notification={n} onClick={() => onClose()} />
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
