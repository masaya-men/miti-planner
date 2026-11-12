import React from 'react';
import { useTranslation } from 'react-i18next';
import { useHousingFilterStore } from '../../../../store/useHousingFilterStore';
import { SEARCH_SWATCHES } from '../../../../lib/housing/color/housingColorSwatches';
import { ColorSwatchGrid } from './ColorSwatchGrid';
import { useSwatchLabel } from './ColorSwatchButton';
import './HousingColorFilter.css';

interface Props {
    /** 地図表示の間は色で絞れない(丸を無効にする)。 */
    disabled?: boolean;
    /** 「色を確認中の家」の件数。0 なら注記を出さない。 */
    pendingCount: number;
}

/** 色で探す: 見出し・選んだ色(押すと外れる)・色の格子・「確認中」の注記。FilterPanel から 1 か所で差し込む。 */
export const HousingColorFilter: React.FC<Props> = ({ disabled, pendingCount }) => {
    const { t } = useTranslation();
    const selected = useHousingFilterStore((s) => s.colorSwatches);
    const toggleColor = useHousingFilterStore((s) => s.toggleColor);
    const labelOf = useSwatchLabel();

    return (
        <section className="housing-color-filter" data-disabled={disabled ? 'true' : undefined}>
            <span className="housing-filter-field-label">{t('housing.workspace.filter.color.title')}</span>
            <div className="housing-color-filter-now" aria-live="polite">
                {selected.length === 0 ? (
                    <span className="housing-color-filter-empty">{t('housing.workspace.filter.color.now_empty')}</span>
                ) : (
                    selected.map((i) => (
                        <button
                            key={i}
                            type="button"
                            className="housing-color-filter-picked"
                            aria-label={t('housing.workspace.filter.color.remove_aria', { name: labelOf(i) })}
                            disabled={disabled}
                            onClick={() => toggleColor(i)}
                        >
                            <span className="housing-color-filter-dot" style={{ background: SEARCH_SWATCHES[i] }} />
                            {labelOf(i)}
                            <span aria-hidden="true" className="housing-color-filter-x">×</span>
                        </button>
                    ))
                )}
            </div>
            <ColorSwatchGrid selected={selected} disabled={disabled} onToggle={toggleColor} />
            {disabled && <p className="housing-color-filter-note">{t('housing.workspace.filter.color.disabled_in_map')}</p>}
            {!disabled && selected.length > 0 && pendingCount > 0 && (
                <p className="housing-color-filter-note">{t('housing.workspace.filter.color.pending_note', { count: pendingCount })}</p>
            )}
        </section>
    );
};
