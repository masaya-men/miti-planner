import { useTranslation } from 'react-i18next';

type Props = {
    value: 'S' | 'M' | 'L' | null;
    onChange: (size: 'S' | 'M' | 'L') => void;
};

export function HousingRegisterParentHouseSizeField({ value, onChange }: Props) {
    const { t } = useTranslation();
    return (
        <div className="housing-parent-size-field" role="radiogroup">
            {(['S', 'M', 'L'] as const).map((size) => (
                <button
                    key={size}
                    type="button"
                    className="housing-type-chip"
                    data-selected={value === size ? 'true' : 'false'}
                    onClick={() => onChange(size)}
                    role="radio"
                    aria-checked={value === size}
                >
                    {t(`housing.register.type.${size}`)}
                </button>
            ))}
        </div>
    );
}
