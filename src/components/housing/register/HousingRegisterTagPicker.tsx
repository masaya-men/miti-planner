import { useTranslation } from 'react-i18next';
import {
  HOUSING_TAG_CATEGORIES,
  getTagsByCategory,
  type HousingTagCategory,
} from '../../../data/housingTags';
import { HOUSING_LIMITS } from '../../../constants/housing';

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
}

export const HousingRegisterTagPicker: React.FC<Props> = ({ selected, onChange }) => {
  const { t } = useTranslation();
  const isFull = selected.length >= HOUSING_LIMITS.MAX_TAGS_PER_LISTING;

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (!isFull) {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-4">
      {selected.length > 0 && (
        <div>
          <p className="text-app-sm text-app-text-muted mb-2">
            {t('housing.register.selected_tags')} ({selected.length}/{HOUSING_LIMITS.MAX_TAGS_PER_LISTING})
          </p>
          <div className="flex flex-wrap gap-2">
            {selected.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 bg-app-text text-app-bg rounded-full px-3 py-1 text-app-sm"
              >
                {t(`housing.tag.${id}`)}
                <button
                  type="button"
                  aria-label={t('housing.register.remove_tag')}
                  onClick={() => toggle(id)}
                  className="ml-1 hover:opacity-70"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {(HOUSING_TAG_CATEGORIES as readonly HousingTagCategory[]).map((cat) => (
        <div key={cat}>
          <p className="text-app-sm text-app-text-muted mb-2">
            {t(`housing.register.tag_category.${cat}`)}
          </p>
          <div className="flex flex-wrap gap-2">
            {getTagsByCategory(cat).map((tag) => {
              const sel = selected.includes(tag.id);
              const disabled = !sel && isFull;
              return (
                <button
                  key={tag.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(tag.id)}
                  className={`rounded-full px-3 py-1 text-app-sm border transition-colors ${
                    sel
                      ? 'bg-app-text text-app-bg border-app-text'
                      : disabled
                        ? 'border-app-border text-app-text-muted opacity-40 cursor-not-allowed'
                        : 'border-app-border text-app-text hover:bg-app-surface2'
                  }`}
                >
                  {t(tag.i18nKey)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
