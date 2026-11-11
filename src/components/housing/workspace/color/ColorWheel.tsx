import React from 'react';
import { useTranslation } from 'react-i18next';
import { SWATCH_HUE_COUNT, SWATCH_TONES } from '../../../../lib/housing/color/housingColorSwatches';
import { ColorSwatchButton } from './ColorSwatchButton';

/** 明るい段(外側)→ 暗い段(内側)の半径(輪の幅に対する %)。 */
const RADII = [46, 37, 28, 19];

/** 輪の上の丸の位置(%)。色相は真上から時計回りに 36 度ずつ。 */
export function wheelPosition(tone: number, hue: number): { x: number; y: number } {
    const angle = ((hue * 360) / SWATCH_HUE_COUNT - 90) * (Math.PI / 180);
    return { x: 50 + RADII[tone] * Math.cos(angle), y: 50 + RADII[tone] * Math.sin(angle) };
}

interface Props {
    selected: readonly number[];
    disabled?: boolean;
    onToggle: (index: number) => void;
    onClear: () => void;
}

/** 4 重の色相環 + 真ん中の「外す」。 */
export const ColorWheel: React.FC<Props> = ({ selected, disabled, onToggle, onClear }) => {
    const { t } = useTranslation();
    const hasPick = selected.length > 0;
    return (
        <div className="housing-color-wheel" role="group" aria-label={t('housing.workspace.filter.color.wheel_aria')}>
            {RADII.map((r) => (
                <span key={r} className="housing-color-wheel-guide" style={{ width: `${r * 2}%`, height: `${r * 2}%` }} aria-hidden="true" />
            ))}
            {Array.from({ length: SWATCH_TONES * SWATCH_HUE_COUNT }, (_, i) => (
                <ColorSwatchButton
                    key={i}
                    index={i}
                    selected={selected.includes(i)}
                    disabled={disabled}
                    onToggle={onToggle}
                    position={wheelPosition(Math.floor(i / SWATCH_HUE_COUNT), i % SWATCH_HUE_COUNT)}
                />
            ))}
            <button
                type="button"
                className="housing-color-wheel-core"
                data-active={hasPick ? 'true' : 'false'}
                disabled={disabled || !hasPick}
                onClick={onClear}
            >
                {hasPick ? t('housing.workspace.filter.color.core_clear') : t('housing.workspace.filter.color.core_label')}
            </button>
        </div>
    );
};
