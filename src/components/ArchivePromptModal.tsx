import React from 'react';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton } from './ui/ModalParts';
import { useTranslation } from 'react-i18next';

interface ArchivePromptModalProps {
    isOpen: boolean;
    planCount: number;
    onClose: () => void;
}

export const ArchivePromptModal: React.FC<ArchivePromptModalProps> = ({
    isOpen, planCount, onClose,
}) => {
    const { t } = useTranslation();
    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            layer="top"
            className="w-full max-w-[400px]"
        >
            <ModalHeader title={t('sidebar.archive_notice_title')} onClose={onClose} closeLabel={t('common.close')} />

            {/* 本文 */}
            <div className="p-6 space-y-3">
                <p className="text-app-md text-app-text text-center">
                    {t('sidebar.archive_notice_message', { count: planCount })}
                </p>
                <p className="text-app-sm text-app-text-muted text-center">
                    {t('sidebar.archive_notice_slow')}
                </p>
            </div>

            <ModalFooter>
                <ModalButton variant="primary" onClick={onClose}>OK</ModalButton>
            </ModalFooter>
        </ModalShell>
    );
};
