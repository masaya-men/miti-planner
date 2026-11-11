import React from 'react';
import { useTranslation } from 'react-i18next';
import { SEARCH_SWATCHES, swatchNameKey, swatchTone } from '../../../../lib/housing/color/housingColorSwatches';

const TONE_KEYS = ['light', 'midLight', 'midDark', 'dark'] as const;

/** 丸 1 つの読み上げ名: 系統名(+ 色相の丸だけ明るさの段)。 */
export function useSwatchLabel(): (index: number) => string {
    const { t } = useTranslation();
    return (index) => {
        const family = t(`housing.workspace.filter.color.family.${swatchNameKey(index)}`);
        const tone = swatchTone(index);
        return tone === null
            ? family
            : t('housing.workspace.filter.color.swatch_aria', {
                family,
                tone: t(`housing.workspace.filter.color.tone.${TONE_KEYS[tone]}`),
            });
    };
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
            disabled={disabled}
            onClick={() => onToggle(index)}
        />
    );
};
