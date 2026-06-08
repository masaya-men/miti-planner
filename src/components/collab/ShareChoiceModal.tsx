// src/components/collab/ShareChoiceModal.tsx
// 共同編集⑤-3a: 共有を押した直後の2択(コピーを配る / 一緒に編集)。意図を最初に選ばせ事故を防ぐ。
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Copy, Users } from 'lucide-react';

interface ShareChoiceModalProps {
  onCopy: () => void;
  onCollab: () => void;
  onClose: () => void;
}

export const ShareChoiceModal: React.FC<ShareChoiceModalProps> = ({ onCopy, onCollab, onClose }) => {
  const { t } = useTranslation();
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="relative glass-tier3 rounded-2xl shadow-2xl w-[340px] max-w-[90vw] overflow-hidden"
        style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-app-border bg-app-surface2/40">
          <h3 className="text-app-2xl font-bold text-app-text">{t('collab.choice_title')}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text transition-all duration-200 active:scale-90"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-2.5">
          <button onClick={onCopy} className="w-full flex items-center gap-3 p-3 rounded-xl border border-app-border bg-app-surface2/40 hover:bg-app-surface2/70 transition-colors text-left">
            <span className="w-8 h-8 rounded-lg bg-app-surface2 flex items-center justify-center shrink-0"><Copy size={16} className="text-app-text" /></span>
            <span><span className="block font-bold text-app-text">{t('collab.choice_copy_title')}</span><span className="block text-app-xs text-app-text-muted">{t('collab.choice_copy_desc')}</span></span>
          </button>
          <button onClick={onCollab} className="w-full flex items-center gap-3 p-3 rounded-xl border border-app-border bg-app-surface2/40 hover:bg-app-surface2/70 transition-colors text-left">
            <span className="w-8 h-8 rounded-lg bg-app-surface2 flex items-center justify-center shrink-0"><Users size={16} className="text-app-text" /></span>
            <span><span className="block font-bold text-app-text">{t('collab.choice_collab_title')}</span><span className="block text-app-xs text-app-text-muted">{t('collab.choice_collab_desc')}</span></span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
