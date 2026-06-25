import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, ShieldAlert, Download, Smartphone, LogIn } from 'lucide-react';
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

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-app-bg border border-app-border rounded-xl shadow-2xl w-[90vw] max-w-[520px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="flex items-center gap-2 text-app-lg font-bold text-app-text">
            <ShieldAlert size={18} aria-hidden="true" />
            {t('local_safety.modal.title')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('local_safety.modal.close')}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

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

        {/* フッター */}
        <div className="flex items-center justify-end px-5 py-4 border-t border-app-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-app-toggle text-app-toggle-text text-app-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            {t('local_safety.modal.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
