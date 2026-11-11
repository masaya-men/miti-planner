import React from 'react';
import { SWATCH_COUNT, SWATCH_HUE_END } from '../../../../lib/housing/color/housingColorSwatches';
import { ColorSwatchButton } from './ColorSwatchButton';

interface Props {
    selected: readonly number[];
    disabled?: boolean;
    onToggle: (index: number) => void;
}

/** 白〜黒の無彩色 10 段(丸の番号 40〜49)。 */
export const ColorNeutralRow: React.FC<Props> = ({ selected, disabled, onToggle }) => (
    <div className="housing-color-neutrals">
        {Array.from({ length: SWATCH_COUNT - SWATCH_HUE_END }, (_, n) => SWATCH_HUE_END + n).map((i) => (
            <ColorSwatchButton key={i} index={i} selected={selected.includes(i)} disabled={disabled} onToggle={onToggle} />
        ))}
    </div>
);
