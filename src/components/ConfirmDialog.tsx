import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
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
    confirmLabel,
    cancelLabel,
    variant = 'danger',
}) => {
    const { t } = useTranslation();
    const finalConfirmLabel = confirmLabel || t('ui.ok');
    const finalCancelLabel = cancelLabel || t('modal.cancel');

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
                "relative w-[360px] max-w-[90vw] rounded-2xl glass-tier3",
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
                    <h3 className="text-sm font-black text-app-text tracking-wide">{title}</h3>
                    <button
                        onClick={onCancel}
                        className="ml-auto p-1 rounded-lg text-app-text hover:bg-app-surface2 transition-colors cursor-pointer"
                    >
                        <X size={14} />
                    </button>
                </div>
                {/* Body */}
                <div className="px-5 py-3">
                    <p className="text-[12px] text-app-text-sec leading-relaxed font-medium">{message}</p>
                </div>
                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-app-border">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl text-[11px] font-black text-app-text-sec hover:text-app-text hover:bg-app-surface2 transition-colors border border-transparent hover:border-app-border cursor-pointer"
                    >
                        {finalCancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={clsx(
                            "px-4 py-2 rounded-xl text-[11px] font-bold text-white transition-all shadow-lg cursor-pointer",
                            variant === 'danger'
                                ? "bg-red-500 hover:bg-red-600 shadow-red-500/25"
                                : "bg-amber-500 hover:bg-amber-600 shadow-amber-500/25"
                        )}
                    >
                        {finalConfirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
