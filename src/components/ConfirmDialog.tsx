import React from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onConfirm,
    onCancel,
    title,
    message,
    confirmLabel = '実行',
    cancelLabel = 'キャンセル',
    variant = 'danger',
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
                onClick={onCancel}
            />
            {/* Dialog */}
            <div className={clsx(
                "relative w-[360px] max-w-[90vw] rounded-2xl border shadow-2xl",
                "bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl",
                "border-slate-200/50 dark:border-white/10",
                "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]"
            )}>
                {/* Header */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-2">
                    <div className={clsx(
                        "p-2 rounded-xl",
                        variant === 'danger' ? "bg-red-500/10" : "bg-amber-500/10"
                    )}>
                        <AlertTriangle size={18} className={
                            variant === 'danger' ? "text-red-500" : "text-amber-500"
                        } />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-wide">{title}</h3>
                    <button
                        onClick={onCancel}
                        className="ml-auto p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
                {/* Body */}
                <div className="px-5 py-3">
                    <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">{message}</p>
                </div>
                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200/50 dark:border-white/5">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-white/10"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={clsx(
                            "px-4 py-2 rounded-xl text-[11px] font-bold text-white transition-all shadow-lg",
                            variant === 'danger'
                                ? "bg-red-500 hover:bg-red-600 shadow-red-500/25"
                                : "bg-amber-500 hover:bg-amber-600 shadow-amber-500/25"
                        )}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
