import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingRegisterForm, type HousingRegisterFormValues } from './HousingRegisterForm';
import { registerListing } from '../../../lib/housingApiClient';
import { HousingPanelModal } from '../HousingPanelModal';
import { getTagById } from '../../../data/housingTags';

type Props = {
    open: boolean;
    onClose: () => void;
};

const SUMMARY_ROWS: Array<{
    key: keyof HousingRegisterFormValues;
    labelKey: string;
}> = [
    { key: 'dc', labelKey: 'housing.register.dc' },
    { key: 'server', labelKey: 'housing.register.server' },
    { key: 'area', labelKey: 'housing.register.area' },
    { key: 'ward', labelKey: 'housing.register.ward' },
    { key: 'plot', labelKey: 'housing.register.plot' },
    { key: 'size', labelKey: 'housing.register.size' },
    { key: 'roomNumber', labelKey: 'housing.register.room_number' },
    { key: 'parentHouseSize', labelKey: 'housing.register.parent_house_size' },
];

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
                maxWidth={480}
            >
                <p className="housing-confirm-message">
                    {t('housing.register.confirm.message')}
                </p>
                {confirmValues && (
                    <dl className="housing-confirm-summary-list">
                        {SUMMARY_ROWS.map(({ key, labelKey }) => {
                            const value = confirmValues[key];
                            if (value === undefined || value === null || value === '') return null;
                            return (
                                <div key={key} className="housing-confirm-summary-row">
                                    <dt>{t(labelKey)}</dt>
                                    <dd>{String(value)}</dd>
                                </div>
                            );
                        })}
                        {confirmValues.description && (
                            <div className="housing-confirm-summary-row" data-block="true">
                                <dt>{t('housing.register.description')}</dt>
                                <dd>{confirmValues.description}</dd>
                            </div>
                        )}
                        {confirmValues.tags && confirmValues.tags.length > 0 && (
                            <div className="housing-confirm-summary-row" data-block="true">
                                <dt>{t('housing.register.tags')}</dt>
                                <dd className="housing-confirm-summary-tags">
                                    {confirmValues.tags.map((id) => {
                                        const tag = getTagById(id);
                                        return (
                                            <span key={id} className="housing-tag-chip">
                                                {tag ? t(tag.i18nKey) : id}
                                            </span>
                                        );
                                    })}
                                </dd>
                            </div>
                        )}
                    </dl>
                )}
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
