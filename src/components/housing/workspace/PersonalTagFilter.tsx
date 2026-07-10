import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchPersonalTags, reportPersonalTag } from '../../../lib/personalTagApiClient';
import { showToast } from '../../Toast';
import type { PersonalTag } from '../../../types/housing';

interface Props {
  /** 現在フィルタに含まれている個人タグ id (探すページのタグフィルタ全体のうち personal_ prefix のもの)。 */
  selected: string[];
  onToggle: (id: string) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

/**
 * 探すページの個人タグフィルタ (「@名前 の家だけのツアー」の入口、 計画書 Phase B-3)。
 * 検索は認証不要 (search-personal-tags は公開 API)。 各結果に軽量な通報ボタンを添える (Phase B-4)。
 */
export const PersonalTagFilter: React.FC<Props> = ({ selected, onToggle }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonalTag[]>([]);
  const [searching, setSearching] = useState(false);
  // id → displayName のキャッシュ (検索で見つかったタグの表示名を、 選択チップ描画時にも使う)。
  const [labels, setLabels] = useState<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      searchPersonalTags(q)
        .then((tags) => {
          setResults(tags);
          setLabels((prev) => {
            const next = { ...prev };
            for (const tag of tags) next[tag.id] = tag.displayName;
            return next;
          });
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleReport = async (tagId: string) => {
    if (!window.confirm(t('housing.workspace.filter.personal_tag_report_confirm'))) return;
    try {
      await reportPersonalTag(tagId);
      showToast(t('housing.workspace.filter.personal_tag_report_success'), 'success');
    } catch {
      showToast(t('housing.workspace.filter.personal_tag_report_error'), 'error');
    }
  };

  return (
    <div className="housing-filter-field">
      <span className="housing-filter-field-label">{t('housing.workspace.filter.personal_tag')}</span>

      {selected.length > 0 && (
        <div className="housing-tag-picker-selected">
          {selected.map((id) => (
            <span key={id} className="housing-tag-chip">
              {labels[id] ?? id}
              <button
                type="button"
                aria-label={t('housing.register.remove_tag')}
                onClick={() => onToggle(id)}
                className="housing-tag-chip-remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('housing.workspace.filter.personal_tag_placeholder')}
        className="housing-input housing-tag-picker-search"
      />

      {query.trim().length > 0 && (
        <div className="housing-tag-picker-list">
          {searching && (
            <div className="housing-tag-picker-empty">
              {t('housing.workspace.filter.personal_tag_searching')}
            </div>
          )}
          {!searching && results.length === 0 && (
            <div className="housing-tag-picker-empty">
              {t('housing.workspace.filter.personal_tag_no_results')}
            </div>
          )}
          {!searching &&
            results.map((tag) => {
              const sel = selected.includes(tag.id);
              return (
                <div key={tag.id} className="housing-personal-tag-result">
                  <button
                    type="button"
                    aria-pressed={sel}
                    onClick={() => onToggle(tag.id)}
                    className="housing-tag-picker-option"
                  >
                    {tag.displayName}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReport(tag.id)}
                    className="housing-personal-tag-report-btn"
                  >
                    {t('housing.workspace.filter.personal_tag_report')}
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
