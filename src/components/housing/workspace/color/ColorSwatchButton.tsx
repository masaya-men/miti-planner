import React from 'react';
import { useTranslation } from 'react-i18next';
import { SEARCH_SWATCHES, swatchNameKey } from '../../../../lib/housing/color/housingColorSwatches';

/** 丸 1 つの名前(赤・白 …)。 */
export function useSwatchLabel(): (index: number) => string {
    const { t } = useTranslation();
    return (index) => t(`housing.workspace.filter.color.family.${swatchNameKey(index)}`);
}

interface Props {
    index: number;
    selected: boolean;
    disabled?: boolean;
    onToggle: (index: number) => void;
}

/** 色の丸 1 つ。押すと選ぶ・もう一度押すと外れる。丸の色は「テーマで変わらない見本の色」なので style の背景で渡す(例外)。 */
export const ColorSwatchButton: React.FC<Props> = ({ index, selected, disabled, onToggle }) => {
    const label = useSwatchLabel()(index);
    return (
        <button
            type="button"
            className="housing-color-swatch"
            style={{ background: SEARCH_SWATCHES[index] }}
            aria-pressed={selected}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onToggle(index)}
        />
    );
};
