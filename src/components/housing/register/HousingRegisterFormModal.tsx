import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { HousingRegisterForm, type HousingRegisterFormValues } from './HousingRegisterForm';
import { registerListing } from '../../../lib/housingApiClient';

type Props = {
    open: boolean;
    onClose: () => void;
};

export function HousingRegisterFormModal({ open, onClose }: Props) {
    const { t } = useTranslation();
    const [confirmValues, setConfirmValues] = useState<HousingRegisterFormValues | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    const handleSubmit = useCallback((values: HousingRegisterFormValues) => {
        setConfirmValues(values);
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!confirmValues) return;
        await registerListing(confirmValues as never);
        setConfirmValues(null);
        onClose();
    }, [confirmValues, onClose]);

    if (!open || !mounted) return null;

    const content = (
        <div
            className="housing-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="housing-register-title"
        >
            <div className="housing-modal-content housing-glass-panel">
                <header className="housing-modal-header">
                    <h2 id="housing-register-title">{t('housing.register.title')}</h2>
                    <button type="button" onClick={onClose} aria-label={t('housing.register.cancel')}>
                        ×
                    </button>
                </header>
                <HousingRegisterForm onSubmit={handleSubmit} onCancel={onClose} />
            </div>

            {confirmValues && (
                <div
                    className="housing-modal-overlay housing-confirm-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="housing-confirm-title"
                >
                    <div className="housing-modal-content housing-glass-panel housing-confirm-content">
                        <h3 id="housing-confirm-title">{t('housing.register.confirm.title')}</h3>
                        <p>{t('housing.register.confirm.message')}</p>
                        <pre className="housing-confirm-summary">
                            {JSON.stringify(confirmValues, null, 2)}
                        </pre>
                        <footer>
                            <button type="button" onClick={() => setConfirmValues(null)}>
                                {t('housing.register.confirm.cancel')}
                            </button>
                            <button type="button" onClick={handleConfirm}>
                                {t('housing.register.confirm.submit')}
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );

    return createPortal(content, document.body);
}
