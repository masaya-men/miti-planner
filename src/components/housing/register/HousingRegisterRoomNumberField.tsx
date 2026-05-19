import { useTranslation } from 'react-i18next';

type Props = {
    mode: 'Apartment' | 'PrivateRoom';
    value: number | null;
    onChange: (n: number | null) => void;
};

export function HousingRegisterRoomNumberField({ mode, value, onChange }: Props) {
    const { t } = useTranslation();
    const max = mode === 'Apartment' ? 90 : 512;
    const labelKey =
        mode === 'Apartment'
            ? 'housing.register.fieldError.roomNumberApartmentOutOfRange'
            : 'housing.register.fieldError.roomNumberPrivateOutOfRange';
    const modeLabelKey =
        mode === 'Apartment' ? 'housing.register.type.apartment' : 'housing.register.type.private';

    const handleChange = (raw: string) => {
        if (raw === '') {
            onChange(null);
            return;
        }
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > max) {
            onChange(null);
            return;
        }
        onChange(n);
    };

    return (
        <div className="housing-room-number-field">
            <label className="housing-label">{t(modeLabelKey)} #</label>
            <input
                type="number"
                className="housing-input"
                min={1}
                max={max}
                value={value ?? ''}
                onChange={(e) => handleChange(e.target.value)}
            />
            {value !== null && (value < 1 || value > max) && (
                <p className="housing-error-text">{t(labelKey)}</p>
            )}
        </div>
    );
}
