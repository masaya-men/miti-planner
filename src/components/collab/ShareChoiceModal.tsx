// src/components/collab/ShareChoiceModal.tsx
// 共同編集⑤-3a: 共有を押した直後の2択(コピーを配る / 一緒に編集)。意図を最初に選ばせ事故を防ぐ。
// 発行は時間がかかるため、collabBusy 中はボタンを無効化+スピナー表示で二重発行(=満員誤判定)を防ぐ。
import React from 'react';
import { ModalShell } from '../ui/ModalShell';
import { ModalHeader } from '../ui/ModalParts';
import { useTranslation } from 'react-i18next';
import { Copy, Users, Loader2 } from 'lucide-react';

interface ShareChoiceModalProps {
  onCopy: () => void;
  onCollab: () => void;
  onClose: () => void;
  collabBusy?: boolean;
}

export const ShareChoiceModal: React.FC<ShareChoiceModalProps> = ({ onCopy, onCollab, onClose, collabBusy = false }) => {
  const { t } = useTranslation();
  return (
    <ModalShell
      isOpen
      onClose={onClose}
      className="w-[340px] max-w-[90vw]"
    >
      <ModalHeader title={t('collab.choice_title')} onClose={onClose} closeLabel={t('common.close')} />
      <div className="p-4 space-y-2.5">
        <button onClick={onCopy} disabled={collabBusy} className="w-full flex items-center gap-3 p-3 rounded-xl border border-app-border bg-app-surface2/40 cursor-pointer hover:bg-app-surface2/70 transition-colors text-left active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
          <span className="w-8 h-8 rounded-lg bg-app-surface2 flex items-center justify-center shrink-0"><Copy size={16} className="text-app-text" /></span>
          <span><span className="block font-bold text-app-text">{t('collab.choice_copy_title')}</span><span className="block text-app-xs text-app-text-muted">{t('collab.choice_copy_desc')}</span></span>
        </button>
        <button onClick={onCollab} disabled={collabBusy} className="w-full flex items-center gap-3 p-3 rounded-xl border border-app-border bg-app-surface2/40 cursor-pointer hover:bg-app-surface2/70 transition-colors text-left active:scale-[0.98] disabled:opacity-70 disabled:cursor-wait">
          <span className="w-8 h-8 rounded-lg bg-app-surface2 flex items-center justify-center shrink-0">
            {collabBusy ? <Loader2 size={16} className="text-app-text animate-spin" /> : <Users size={16} className="text-app-text" />}
          </span>
          <span><span className="block font-bold text-app-text">{collabBusy ? t('collab.choice_collab_busy') : t('collab.choice_collab_title')}</span><span className="block text-app-xs text-app-text-muted">{t('collab.choice_collab_desc')}</span></span>
        </button>
      </div>
    </ModalShell>
  );
};
