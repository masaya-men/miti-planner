import { useTranslation } from 'react-i18next';
import type { HousingExtractSize } from '../../../lib/housing/parseHousingFromText';

type Props = {
    value: HousingExtractSize | null;
    onChange: (size: HousingExtractSize) => void;
};

const TYPES: Array<{ id: HousingExtractSize; key: string }> = [
    { id: 'S', key: 'S' },
    { id: 'M', key: 'M' },
    { id: 'L', key: 'L' },
    { id: 'PrivateRoom', key: 'private' },
    { id: 'Apartment', key: 'apartment' },
];

export function HousingRegisterTypeSelector({ value, onChange }: Props) {
    const { t } = useTranslation();
    return (
        <div className="housing-type-selector" role="radiogroup">
            {TYPES.map(({ id, key }) => (
                <button
                    key={id}
                    type="button"
                    className="housing-type-chip"
                    data-selected={value === id ? 'true' : 'false'}
                    onClick={() => onChange(id)}
                    role="radio"
                    aria-checked={value === id}
                >
                    {t(`housing.register.type.${key}`)}
                </button>
            ))}
        </div>
    );
}
