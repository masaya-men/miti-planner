import React from 'react';
import { useTranslation } from 'react-i18next';
import { useHousingFilterStore } from '../../../../store/useHousingFilterStore';
import { SEARCH_SWATCHES } from '../../../../lib/housing/color/housingColorSwatches';
import { ColorWheel } from './ColorWheel';
import { ColorNeutralRow } from './ColorNeutralRow';
import { useSwatchLabel } from './ColorSwatchButton';
import './HousingColorFilter.css';

interface Props {
    /** 地図表示の間は色で絞れない(丸を無効にする)。 */
    disabled?: boolean;
    /** 「色を確認中の家」の件数。0 なら注記を出さない。 */
    pendingCount: number;
}

/** 色で探す: 見出し・今の色名・色相環・無彩色・「確認中」の注記。FilterPanel から 1 か所で差し込む。 */
export const HousingColorFilter: React.FC<Props> = ({ disabled, pendingCount }) => {
    const { t } = useTranslation();
    const selected = useHousingFilterStore((s) => s.colorSwatches);
    const toggleColor = useHousingFilterStore((s) => s.toggleColor);
    const clearColors = useHousingFilterStore((s) => s.clearColors);
    const labelOf = useSwatchLabel();

    const last = selected.length > 0 ? selected[selected.length - 1] : null;
    const nowName = last === null
        ? t('housing.workspace.filter.color.now_empty')
        : selected.length === 1
            ? labelOf(last)
            : t('housing.workspace.filter.color.now_more', { name: labelOf(last), count: selected.length - 1 });

    return (
        <section className="housing-color-filter" data-disabled={disabled ? 'true' : undefined}>
            <div className="housing-color-filter-head">
                <span className="housing-filter-field-label">{t('housing.workspace.filter.color.title')}</span>
                {selected.length > 0 && (
                    <button type="button" className="housing-color-filter-clear" onClick={clearColors}>
                        {t('housing.workspace.filter.color.clear')}
                    </button>
                )}
            </div>
            <div className="housing-color-filter-now" aria-live="polite">
                {last !== null && <span className="housing-color-filter-dot" style={{ background: SEARCH_SWATCHES[last] }} />}
                <span data-empty={last === null ? 'true' : undefined}>{nowName}</span>
            </div>
            <ColorWheel selected={selected} disabled={disabled} onToggle={toggleColor} onClear={clearColors} />
            <ColorNeutralRow selected={selected} disabled={disabled} onToggle={toggleColor} />
            {disabled && <p className="housing-color-filter-note">{t('housing.workspace.filter.color.disabled_in_map')}</p>}
            {!disabled && selected.length > 0 && pendingCount > 0 && (
                <p className="housing-color-filter-note">{t('housing.workspace.filter.color.pending_note', { count: pendingCount })}</p>
            )}
        </section>
    );
};
