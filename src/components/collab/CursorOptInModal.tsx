// ④-b-2: カーソル ON 時の正直な説明(インフォームド・オプトイン)。
// IP 露出を伴うため、ON にする瞬間に事実を淡々と提示してから確定する。
import React from 'react';
import { ModalShell } from '../ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton } from '../ui/ModalParts';
import { useTranslation } from 'react-i18next';

interface Props { onConfirm: () => void; onCancel: () => void; }

export const CursorOptInModal: React.FC<Props> = ({ onConfirm, onCancel }) => {
  const { t } = useTranslation();
  return (
    <ModalShell
      isOpen
      onClose={onCancel}
      className="w-[360px] max-w-[90vw]"
    >
      <ModalHeader title={t('collab.cursor_optin_title')} onClose={onCancel} closeLabel={t('common.close')} />
      <div className="p-5 space-y-3 overflow-y-auto">
      <p className="text-app-sm leading-relaxed text-app-text-muted">{t('collab.cursor_optin_body')}</p>
      <p className="text-app-sm leading-relaxed rounded-lg p-3 border border-app-border bg-app-surface2/40 text-app-text-muted">
        {t('collab.cursor_optin_ip')}
      </p>
      <p className="text-app-xs text-app-text-muted">{t('collab.cursor_optin_reassure')}</p>
      </div>
      <ModalFooter>
        <ModalButton variant="secondary" onClick={onCancel}>{t('collab.cursor_optin_cancel')}</ModalButton>
        <ModalButton variant="primary" onClick={onConfirm}>{t('collab.cursor_optin_confirm')}</ModalButton>
      </ModalFooter>
    </ModalShell>
  );
};
