import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { useSystemNotifications } from '../store/useSystemNotifications';
import { SystemNotificationModal } from './SystemNotificationModal';

/**
 * サイドバー折りたたみ時、ハンドル領域の上部に出す未読通知ベル。
 * - 未読が無ければ何も描画しない (= 通常時はハンドルに何も足さない)。
 * - クリックでサイドバーを開かずに通知モーダルを直接開く。
 * - 親 (ハンドル div) が relative なので absolute で上部中央に重ねる。
 *   開閉トグル (z-50) より上に出すため z-[60] + クリックは stopPropagation で
 *   トグル誤作動を防ぐ。
 */
export const SystemNotificationHandleButton: React.FC = () => {
  const { t } = useTranslation();
  const { latestUnread, markRead } = useSystemNotifications();
  const [open, setOpen] = useState(false);

  if (!latestUnread) return null;

  function handleClose() {
    setOpen(false);
    if (latestUnread) markRead(latestUnread.id);
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // ハンドルの開閉トグルを誤発火させない
          setOpen(true);
        }}
        aria-label={t('system_notif.bar.aria_bell')}
        className="absolute top-1 left-0 right-0 mx-auto z-[60] flex items-center justify-center w-6 h-6 text-app-text hover:bg-app-surface2 transition-colors cursor-pointer"
      >
        <span className="relative flex">
          <Bell size={14} aria-hidden="true" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-app-bg" aria-hidden="true" />
        </span>
      </button>
      <SystemNotificationModal isOpen={open} notif={latestUnread} onClose={handleClose} />
    </>
  );
};
