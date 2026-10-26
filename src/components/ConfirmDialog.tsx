import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton } from './ui/ModalParts';

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

    return (
        <ModalShell isOpen={isOpen} onClose={onCancel} layer="confirm" className="w-[360px] max-w-[90vw]">
            <ModalHeader
                icon={
                    <span className={clsx(
                        "p-2 rounded-xl",
                        variant === 'danger' ? "bg-app-red-dim" : "bg-app-amber-dim"
                    )}>
                        <AlertTriangle size={18} className={
                            variant === 'danger' ? "text-app-red" : "text-app-amber"
                        } />
                    </span>
                }
                title={title}
                onClose={onCancel}
                closeLabel={t('common.close')}
            />
            <div className="px-5 py-3 overflow-y-auto">
                <p className="text-app-lg text-app-text-sec leading-relaxed font-medium whitespace-pre-line">{message}</p>
            </div>
            <ModalFooter>
                <ModalButton variant="secondary" onClick={onCancel}>{finalCancelLabel}</ModalButton>
                <ModalButton variant={variant} onClick={onConfirm}>{finalConfirmLabel}</ModalButton>
            </ModalFooter>
        </ModalShell>
    );
};
