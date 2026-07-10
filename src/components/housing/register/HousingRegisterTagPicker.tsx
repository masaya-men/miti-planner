import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HOUSING_TAGS,
  STATIC_HOUSING_TAG_KINDS,
  type StaticHousingTagKind,
} from '../../../data/housingTags';
import { HOUSING_LIMITS } from '../../../constants/housing';

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
}

/**
 * kind タブ (公式/季節/テーマ) + 検索 + 選択 chips のコンパクトピッカー。
 * 2026-07-10 タグ体系刷新: 個人タグタブは Phase B (HousingPersonalTagPanel) で追加する。
 * タブ列は STATIC_HOUSING_TAG_KINDS (レジストリ) から導出、 kind 名の switch 分岐は書かない。
 */
export const HousingRegisterTagPicker: React.FC<Props> = ({ selected, onChange }) => {
  const { t } = useTranslation();
  const isFull = selected.length >= HOUSING_LIMITS.MAX_TAGS_PER_LISTING;
  const [activeKind, setActiveKind] = useState<StaticHousingTagKind>(STATIC_HOUSING_TAG_KINDS[0]);
  const [query, setQuery] = useState('');

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (!isFull) {
      onChange([...selected, id]);
    }
  };

  // 検索中: 全 kind 横断、 マッチを翻訳済み表示名でフィルタ。 空クエリ: 選択 kind のみ。
  const visibleTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return HOUSING_TAGS.filter((tag) => {
        const label = String(t(tag.i18nKey, { defaultValue: tag.id })).toLowerCase();
        return tag.id.includes(q) || label.includes(q);
      });
    }
    return HOUSING_TAGS.filter((tag) => tag.kind === activeKind);
  }, [query, activeKind, t]);

  const selectedTagObjects = useMemo(
    () => selected.map((id) => HOUSING_TAGS.find((tag) => tag.id === id)).filter(Boolean) as typeof HOUSING_TAGS,
    [selected],
  );

  return (
    <div className="housing-tag-picker">
      <div className="housing-tag-picker-selected" aria-label={t('housing.register.selected_tags')}>
        {selectedTagObjects.length === 0 && (
          <span className="housing-tag-picker-counter">
            {t('housing.register.tag_pick_hint', { max: HOUSING_LIMITS.MAX_TAGS_PER_LISTING })}
          </span>
        )}
        {selectedTagObjects.map((tag) => (
          <span key={tag.id} className="housing-tag-chip">
            {t(tag.i18nKey)}
            <button
              type="button"
              aria-label={t('housing.register.remove_tag')}
              onClick={() => toggle(tag.id)}
              className="housing-tag-chip-remove"
            >
              ×
            </button>
          </span>
        ))}
        {selectedTagObjects.length > 0 && (
          <span className="housing-tag-picker-counter">
            {selected.length} / {HOUSING_LIMITS.MAX_TAGS_PER_LISTING}
          </span>
        )}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('housing.register.tag_search_placeholder')}
        className="housing-input housing-tag-picker-search"
      />

      {!query && (
        <div className="housing-tag-picker-tabs" role="tablist">
          {STATIC_HOUSING_TAG_KINDS.map((kind) => (
            <button
              key={kind}
              role="tab"
              type="button"
              aria-selected={activeKind === kind}
              onClick={() => setActiveKind(kind)}
              className="housing-tag-picker-tab"
            >
              {t(`housing.register.tag_kind.${kind}`)}
            </button>
          ))}
        </div>
      )}

      <div className="housing-tag-picker-list">
        {visibleTags.length === 0 ? (
          <div className="housing-tag-picker-empty">
            {t('housing.register.tag_no_results')}
          </div>
        ) : (
          visibleTags.map((tag) => {
            const sel = selected.includes(tag.id);
            const disabled = !sel && isFull;
            return (
              <button
                key={tag.id}
                type="button"
                disabled={disabled}
                aria-pressed={sel}
                onClick={() => toggle(tag.id)}
                className="housing-tag-picker-option"
              >
                {t(tag.i18nKey)}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
