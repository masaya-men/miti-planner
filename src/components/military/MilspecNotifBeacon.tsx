import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSystemNotifications } from '../../store/useSystemNotifications';
import { SystemNotificationModal } from '../SystemNotificationModal';
import { normalizeLang } from '../SystemNotificationBar';
import { resolveLocalized } from '../../lib/localizedText';
import { MilspecLed, MilspecStencil } from './MilspecDecor';
import { SB_NOTIF, sbY } from './sidebarGeometry';
import './milspecNotifBeacon.css';

const OUTLINE = SB_NOTIF.pts.map((p) => p.join(',')).join(' ');

/**
 * 運営通知のマーク。未読があるときだけサイドバーの隙間(SB_NOTIF)に出る装甲の小札。
 * 押すと標準テーマと同じ SystemNotificationModal で最新の未読を開き、閉じたら既読にしてマークは消える。
 * H は区画の実高(位置を箱の座標に追従させる)。
 */
export const MilspecNotifBeacon: React.FC<{ H: number }> = ({ H }) => {
  const { t, i18n } = useTranslation();
  const lang = normalizeLang(i18n.language ?? 'ja');
  const { latestUnread, markRead } = useSystemNotifications();
  const [open, setOpen] = useState(false);

  // モーダルを閉じて既読になった瞬間に latestUnread が変わっても、閉じる演出の間は描画を保つ必要はない(即消える)
  if (!latestUnread) return null;

  const title = resolveLocalized(latestUnread.title, lang);
  const handleClose = () => {
    setOpen(false);
    markRead(latestUnread.id);
  };

  return (
    <>
      <button
        type="button"
        className="milspec-notif"
        style={{ left: SB_NOTIF.x, top: sbY(SB_NOTIF.y, H), width: SB_NOTIF.w, height: SB_NOTIF.h }}
        aria-label={t('system_notif.bar.aria_bell')}
        title={title}
        onClick={() => setOpen(true)}
      >
        <svg className="milspec-notif-plate" viewBox={`0 0 ${SB_NOTIF.w} ${SB_NOTIF.h}`} aria-hidden="true">
          <polygon className="milspec-notif-body" points={OUTLINE} />
          <polygon className="milspec-notif-rim" points={OUTLINE} />
        </svg>
        <span className="milspec-notif-row">
          <svg className="milspec-notif-bell" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 12h9l-1.2-1.6V7a3.3 3.3 0 0 0-6.6 0v3.4zM6.6 13.8h2.8" />
          </svg>
          <MilspecLed state="warn" size={7} blink flick />
        </span>
        <MilspecStencil en="MSG" hi />
      </button>
      <SystemNotificationModal isOpen={open} notif={latestUnread} onClose={handleClose} />
    </>
  );
};
