import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldState } from '../../../lib/housing/housingFieldState';

type Props = {
    state: FieldState;
    onConfirm: () => void;
};

export function HousingRegisterFieldBadge({ state, onConfirm }: Props) {
    const { t } = useTranslation();
    const [animating, setAnimating] = useState(false);

    const handleClick = useCallback(() => {
        setAnimating(true);
        onConfirm();
        window.setTimeout(() => setAnimating(false), 700);
    }, [onConfirm]);

    if (state !== 'auto-filled') return null;

    return (
        <>
            <span
                data-testid="housing-auto-badge"
                className="housing-field-badge"
                aria-label={t('housing.register.fieldBadge.autoFilled')}
            >
                🟡
            </span>
            <button
                type="button"
                data-testid="housing-confirm-button"
                className="housing-confirm-button"
                data-animating={animating ? 'true' : 'false'}
                onClick={handleClick}
                aria-label={t('housing.register.fieldBadge.confirmAriaLabel')}
                title={t('housing.register.fieldBadge.confirmTooltip')}
            >
                <svg width="14" height="14" viewBox="0 0 14 14">
                    <path d="M2.5 7 L6 10.5 L11.5 4" />
                </svg>
            </button>
        </>
    );
}
