import React from 'react';
import { useTranslation } from 'react-i18next';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton } from './ui/ModalParts';

interface Props {
    isOpen: boolean;
    onCancel: () => void;
    onAccept: () => void;
}

export const PopularConsentDialog: React.FC<Props> = ({ isOpen, onCancel, onAccept }) => {
    const { t } = useTranslation();

    return (
        <ModalShell isOpen={isOpen} onClose={onCancel} className="w-[400px] max-w-[90vw]">
            <ModalHeader title={t('popular_consent.title')} onClose={onCancel} closeLabel={t('common.close')} />
            <div className="p-6 overflow-y-auto">
                <p className="text-app-lg text-app-text-muted leading-relaxed mb-3">
                    {t('popular_consent.body_1')}
                </p>
                <p className="text-app-lg text-app-text-muted leading-relaxed">
                    {t('popular_consent.body_2')}
                </p>
            </div>
            <ModalFooter>
                <ModalButton variant="secondary" onClick={onCancel}>{t('popular_consent.cancel')}</ModalButton>
                <ModalButton variant="primary" onClick={onAccept}>{t('popular_consent.accept')}</ModalButton>
            </ModalFooter>
        </ModalShell>
    );
};
