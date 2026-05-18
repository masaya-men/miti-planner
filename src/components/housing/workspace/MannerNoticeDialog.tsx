import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'housing-manner-dismissed';

export function isMannerNoticeDismissed(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
}

export interface MannerNoticeDialogProps {
    open: boolean;
    onCancel: () => void;
    onStart: () => void;
}

export const MannerNoticeDialog: React.FC<MannerNoticeDialogProps> = ({
    open,
    onCancel,
    onStart,
}) => {
    const { t } = useTranslation();
    const [dontShow, setDontShow] = useState(false);

    if (!open) return null;

    const handleStart = () => {
        if (dontShow && typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(STORAGE_KEY, 'true');
        }
        onStart();
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={t('housing.workspace.manner.title')}
            className="housing-manner-backdrop"
            onClick={onCancel}
        >
            <div className="housing-manner-card" onClick={(e) => e.stopPropagation()}>
                <h2 className="housing-manner-title">
                    <span aria-hidden="true">🏠</span> {t('housing.workspace.manner.title')}
                </h2>
                <p className="housing-manner-body">{t('housing.workspace.manner.body')}</p>
                <label className="housing-manner-checkbox">
                    <input
                        type="checkbox"
                        checked={dontShow}
                        onChange={(e) => setDontShow(e.target.checked)}
                    />
                    <span>{t('housing.workspace.manner.dont_show_again')}</span>
                </label>
                <div className="housing-manner-actions">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="housing-manner-btn housing-manner-btn-cancel"
                    >
                        {t('housing.workspace.manner.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleStart}
                        className="housing-manner-btn housing-manner-btn-start"
                    >
                        {t('housing.workspace.manner.start')}
                    </button>
                </div>
            </div>
        </div>
    );
};
