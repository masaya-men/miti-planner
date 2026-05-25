import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MEMO_LIMITS } from '../../types/firebase';

interface MemoFloatingBarProps {
    memoCount: number;
    onExit: () => void;
}

export const MemoFloatingBar: React.FC<MemoFloatingBarProps> = ({ memoCount, onExit }) => {
    const { t } = useTranslation();

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onExit();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onExit]);

    return createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-app-surface border border-app-border rounded-full shadow-lg px-4 py-2 flex items-center gap-3 text-app-sm">
            <Pencil size={14} className="text-app-text" />
            <span className="font-medium">
                {t('memo.floating_bar_count', { count: memoCount, max: MEMO_LIMITS.MAX_MEMOS_PER_PLAN })}
            </span>
            <button
                type="button"
                onClick={onExit}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-app-surface2 text-app-text-muted"
            >
                <X size={12} />
                {t('memo.floating_bar_exit')}
            </button>
        </div>,
        document.body
    );
};
