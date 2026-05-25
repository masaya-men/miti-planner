import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { useSystemNotifications } from '../store/useSystemNotifications';
import { SystemNotificationModal } from './SystemNotificationModal';
import { resolveLocalized } from '../lib/localizedText';

interface Props {
  /** Sidebar が折りたたまれているとき true。 マーキー非表示、 ベルのみに */
  isCollapsed: boolean;
}

type SupportedLang = 'ja' | 'en' | 'ko' | 'zh';
function normalizeLang(lang: string): SupportedLang {
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('zh')) return 'zh';
  return 'ja';
}

export const SystemNotificationBar: React.FC<Props> = ({ isCollapsed }) => {
  const { t, i18n } = useTranslation();
  const lang = normalizeLang(i18n.language);
  const { latestUnread, markRead } = useSystemNotifications();
  const [open, setOpen] = useState(false);

  // 未読 0 → バー枠ごと描画しない (Sidebar が縮む)
  if (!latestUnread) return null;

  const title = resolveLocalized(latestUnread.title, lang);
  const body = resolveLocalized(latestUnread.body, lang).replace(/\s*\n+\s*/g, ' ');
  const marqueeText = `${title}：${body}`;

  function handleClose() {
    setOpen(false);
    if (latestUnread) markRead(latestUnread.id);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('system_notif.bar.aria_bell')}
        className="w-full border-t border-b border-app-text/10 flex items-stretch min-h-9 select-none cursor-pointer hover:bg-app-text/5 transition-colors text-left"
      >
        <span className="shrink-0 px-3 py-1.5 flex items-center text-app-text">
          <Bell size={16} aria-hidden="true" />
        </span>
        {!isCollapsed && (
          <span className="flex-1 min-w-0 overflow-hidden py-1.5">
            <span className="text-app-sm text-app-text-muted system-notif-marquee">
              {marqueeText}
            </span>
          </span>
        )}
      </button>
      <SystemNotificationModal isOpen={open} notif={latestUnread} onClose={handleClose} />
    </>
  );
};
