import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STATIC_HOUSING_TAG_KINDS, getTagsByKind } from '../../../../data/housingTags';

export interface AllTagsSectionProps {
  selected: string[];
  onToggle: (id: string) => void;
}

/**
 * タグ検索「タグ全部」セクション。公式/季節/テーマ/初心者 (計48件) を1つのチップ羅列にまとめ、
 * kindごとに軽い区切り線+小ラベルを添えて見分けやすくする (design 2026-07-27 §2)。
 * kindラベルは housing.register.tag_kind.* を再利用する (新規キーを切らない)。
 */
export const AllTagsSection: React.FC<AllTagsSectionProps> = ({ selected, onToggle }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  const title = t('housing.tagpicker.all_tags_section_title');

  return (
    <div className="housing-tagpicker-section">
      <button
        type="button"
        className="housing-tagpicker-section-header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="housing-tagpicker-section-title">{title}</span>
      </button>
      {open && (
        <div className="housing-tagpicker-section-body">
          {STATIC_HOUSING_TAG_KINDS.map((kind) => (
            <div key={kind} className="housing-tagpicker-kind-group">
              <div className="housing-tagpicker-kind-label">
                {t(`housing.register.tag_kind.${kind}`)}
              </div>
              <div className="housing-tagpicker-chip-grid">
                {getTagsByKind(kind).map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className="housing-tagpicker-chip"
                    data-selected={selected.includes(tag.id) ? 'true' : 'false'}
                    onClick={() => onToggle(tag.id)}
                  >
                    {t(tag.i18nKey, { defaultValue: tag.id })}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
