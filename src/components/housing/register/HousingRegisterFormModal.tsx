import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingRegisterForm, type HousingRegisterFormValues } from './HousingRegisterForm';
import { registerListing } from '../../../lib/housingApiClient';
import { HousingPanelModal } from '../HousingPanelModal';

type Props = {
    open: boolean;
    onClose: () => void;
};

export function HousingRegisterFormModal({ open, onClose }: Props) {
    const { t } = useTranslation();
    const [confirmValues, setConfirmValues] = useState<HousingRegisterFormValues | null>(null);

    const handleSubmit = useCallback((values: HousingRegisterFormValues) => {
        setConfirmValues(values);
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!confirmValues) return;
        await registerListing(confirmValues as never);
        setConfirmValues(null);
        onClose();
    }, [confirmValues, onClose]);

    return (
        <>
            <HousingPanelModal
                open={open}
                onClose={onClose}
                title={t('housing.register.title')}
                closeLabel={t('housing.register.cancel')}
                maxWidth={720}
            >
                <HousingRegisterForm onSubmit={handleSubmit} onCancel={onClose} />
            </HousingPanelModal>

            <HousingPanelModal
                open={open && confirmValues !== null}
                onClose={() => setConfirmValues(null)}
                title={t('housing.register.confirm.title')}
                closeLabel={t('housing.register.confirm.cancel')}
                maxWidth={460}
            >
                <p className="housing-confirm-message">
                    {t('housing.register.confirm.message')}
                </p>
                <pre className="housing-confirm-summary">
                    {JSON.stringify(confirmValues, null, 2)}
                </pre>
                <div className="housing-confirm-actions">
                    <button type="button" onClick={() => setConfirmValues(null)}>
                        {t('housing.register.confirm.cancel')}
                    </button>
                    <button type="button" data-variant="primary" onClick={handleConfirm}>
                        {t('housing.register.confirm.submit')}
                    </button>
                </div>
            </HousingPanelModal>
        </>
    );
}
