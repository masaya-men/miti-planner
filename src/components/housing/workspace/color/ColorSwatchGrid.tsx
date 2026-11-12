import React from 'react';
import { useTranslation } from 'react-i18next';
import { SWATCH_COUNT } from '../../../../lib/housing/color/housingColorSwatches';
import { ColorSwatchButton } from './ColorSwatchButton';

interface Props {
    selected: readonly number[];
    disabled?: boolean;
    onToggle: (index: number) => void;
}

/** 13 色の格子: 7 列 × 2 行。丸の番号順にそのまま並べる。 */
export const ColorSwatchGrid: React.FC<Props> = ({ selected, disabled, onToggle }) => {
    const { t } = useTranslation();
    return (
        <div className="housing-color-grid" role="group" aria-label={t('housing.workspace.filter.color.wheel_aria')}>
            {Array.from({ length: SWATCH_COUNT }, (_, i) => (
                <ColorSwatchButton key={i} index={i} selected={selected.includes(i)} disabled={disabled} onToggle={onToggle} />
            ))}
        </div>
    );
};
