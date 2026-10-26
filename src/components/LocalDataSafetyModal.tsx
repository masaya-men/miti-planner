import React from 'react';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton } from './ui/ModalParts';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Download, Smartphone, LogIn } from 'lucide-react';
import { isIOS } from '../utils/isIOS';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenBackup: () => void;
}

export const LocalDataSafetyModal: React.FC<Props> = ({ isOpen, onClose, onOpenBackup }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const iosFirst = isIOS();

  const backupBlock = (
    <button
      onClick={onOpenBackup}
      className="w-full flex items-start gap-3 p-3 rounded-lg border border-app-border hover:bg-glass-hover transition-colors cursor-pointer text-left"
    >
      <Download size={18} className="shrink-0 mt-0.5 text-app-text" />
      <span className="flex flex-col">
        <span className="text-app-sm font-bold text-app-text">{t('local_safety.modal.backup_button')}</span>
        <span className="text-app-xs text-app-text-muted">{t('local_safety.modal.backup_desc')}</span>
      </span>
    </button>
  );

  const iosBlock = (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-app-border">
      <Smartphone size={18} className="shrink-0 mt-0.5 text-app-text" />
      <span className="flex flex-col">
        <span className="text-app-sm font-bold text-app-text">{t('local_safety.modal.ios_heading')}</span>
        <span className="text-app-xs text-app-text-muted">{t('local_safety.modal.ios_body')}</span>
      </span>
    </div>
  );

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      className="w-[90vw] max-w-[520px] max-h-[80vh]"
    >
      <ModalHeader
        icon={<ShieldAlert size={18} aria-hidden="true" />}
        title={t('local_safety.modal.title')}
        onClose={onClose}
        closeLabel={t('local_safety.modal.close')}
      />

      {/* 本文 */}
      <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
        <section className="flex flex-col gap-1">
          <h3 className="text-app-sm font-bold text-app-text">{t('local_safety.modal.why_heading')}</h3>
          <p className="text-app-sm text-app-text-muted">{t('local_safety.modal.why_body')}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-app-sm font-bold text-app-text">{t('local_safety.modal.protect_heading')}</h3>
          {iosFirst ? <>{iosBlock}{backupBlock}</> : <>{backupBlock}{iosBlock}</>}
          <div className="flex items-start gap-3 p-3 rounded-lg">
            <LogIn size={18} className="shrink-0 mt-0.5 text-app-text-muted" />
            <span className="text-app-xs text-app-text-muted">{t('local_safety.modal.login_note')}</span>
          </div>
        </section>
      </div>

      <ModalFooter>
        <ModalButton variant="primary" onClick={onClose}>{t('local_safety.modal.close')}</ModalButton>
      </ModalFooter>
    </ModalShell>
  );
};
