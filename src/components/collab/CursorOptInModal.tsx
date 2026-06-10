// ④-b-2: カーソル ON 時の正直な説明(インフォームド・オプトイン)。
// IP 露出を伴うため、ON にする瞬間に事実を淡々と提示してから確定する。
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface Props { onConfirm: () => void; onCancel: () => void; }

export const CursorOptInModal: React.FC<Props> = ({ onConfirm, onCancel }) => {
  const { t } = useTranslation();
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" onClick={onCancel}>
      <div
        className="relative glass-tier3 rounded-2xl shadow-2xl w-[360px] max-w-[90vw] p-5 space-y-3"
        style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-app-xl font-bold text-app-text">{t('collab.cursor_optin_title')}</h3>
        <p className="text-app-sm leading-relaxed text-app-text-muted">{t('collab.cursor_optin_body')}</p>
        <p className="text-app-sm leading-relaxed rounded-lg p-3 border border-app-border bg-app-surface2/40 text-app-text-muted">
          {t('collab.cursor_optin_ip')}
        </p>
        <p className="text-app-xs text-app-text-muted">{t('collab.cursor_optin_reassure')}</p>
        <div className="flex gap-2 pt-2">
          <button onClick={onCancel} className="flex-1 h-9 rounded-lg border border-app-border bg-app-surface2/60 text-app-text text-app-sm active:scale-95">
            {t('collab.cursor_optin_cancel')}
          </button>
          <button onClick={onConfirm} className="flex-1 h-9 rounded-lg bg-app-text text-app-bg font-bold text-app-sm active:scale-95">
            {t('collab.cursor_optin_confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
