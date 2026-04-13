import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface ArchivePromptModalProps {
    isOpen: boolean;
    planCount: number;
    onArchive: () => void;
    onDismiss: () => void;
}

export const ArchivePromptModal: React.FC<ArchivePromptModalProps> = ({
    isOpen, planCount, onArchive, onDismiss,
}) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
            onClick={onDismiss}
        >
            <div
                className="relative w-full max-w-[400px] glass-tier3 rounded-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="px-6 py-5 border-b border-glass-border/30 flex items-center justify-between bg-glass-header/30">
                    <h2 className="text-app-xl font-black text-app-text tracking-widest flex items-center gap-3 uppercase">
                        <span className="w-1.5 h-4 bg-app-toggle rounded-full" />
                        {t('sidebar.archive_confirm_title')}
                    </h2>
                    <button
                        onClick={onDismiss}
                        className="p-2 rounded-full text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 本文 */}
                <div className="p-6 space-y-3">
                    <p className="text-app-xl font-bold text-app-text text-center">
                        {t('sidebar.archive_confirm_message')}
                    </p>
                    <p className="text-app-md text-app-text-muted text-center">
                        {t('sidebar.archive_plan_count', { count: planCount })}
                    </p>
                </div>

                {/* フッターボタン */}
                <div className="p-6 bg-glass-card/10 border-t border-glass-border/20 flex gap-4">
                    <button
                        onClick={onDismiss}
                        className="flex-1 py-3.5 rounded-2xl border border-glass-border/40 text-app-md font-black text-app-text hover:bg-glass-hover transition-all cursor-pointer uppercase tracking-widest active:scale-95"
                    >
                        {t('sidebar.archive_confirm_no')}
                    </button>
                    <button
                        onClick={onArchive}
                        className="flex-[2] py-3.5 rounded-2xl text-app-md font-black bg-app-toggle text-app-toggle-text hover:opacity-80 transition-all cursor-pointer uppercase tracking-[0.3em] active:scale-95"
                    >
                        {t('sidebar.archive_confirm_yes')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
