import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HOUSING_TAGS,
  HOUSING_TAG_KINDS,
  type HousingTagKind,
} from '../../../data/housingTags';
import { HOUSING_LIMITS } from '../../../constants/housing';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import { usePersonalTag } from './usePersonalTag';

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
}

/**
 * kind タブ (公式/季節/テーマ/個人) + 検索 + 選択 chips のコンパクトピッカー。
 * タブ列は HOUSING_TAG_KINDS (レジストリ) から導出、 kind 名の switch 分岐は書かない。
 * ただし「個人」タブのみ、 静的レジストリを持たない (Firestore 動的データ) ため、
 * 中身の描画だけ専用分岐にしている (タブの一覧・順序・ラベルはレジストリ駆動のまま)。
 */
export const HousingRegisterTagPicker: React.FC<Props> = ({ selected, onChange }) => {
  const { t } = useTranslation();
  const isFull = selected.length >= HOUSING_LIMITS.MAX_TAGS_PER_LISTING;
  const [activeKind, setActiveKind] = useState<HousingTagKind>(HOUSING_TAG_KINDS[0]);
  const [query, setQuery] = useState('');
  const openAccount = useHousingModalStore((s) => s.openAccount);

  const { tag: myPersonalTag, loading: personalTagLoading, isPublished: personalTagIsPublished } = usePersonalTag();

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (!isFull) {
      onChange([...selected, id]);
    }
  };

  // 検索中: 静的タグ (公式/季節/テーマ) を横断、 マッチを翻訳済み表示名でフィルタ。
  // 個人タグは自分の 1 件のみのため検索対象に含めない (「個人」タブで直接トグルする)。
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

  const selectedStaticTags = useMemo(
    () => selected.map((id) => HOUSING_TAGS.find((tag) => tag.id === id)).filter(Boolean) as typeof HOUSING_TAGS,
    [selected],
  );
  const selectedPersonalTag = myPersonalTag && selected.includes(myPersonalTag.id) ? myPersonalTag : null;
  const selectedCount = selectedStaticTags.length + (selectedPersonalTag ? 1 : 0);

  return (
    <div className="housing-tag-picker">
      <div className="housing-tag-picker-selected" aria-label={t('housing.register.selected_tags')}>
        {selectedCount === 0 && (
          <span className="housing-tag-picker-counter">
            {t('housing.register.tag_pick_hint', { max: HOUSING_LIMITS.MAX_TAGS_PER_LISTING })}
          </span>
        )}
        {selectedStaticTags.map((tag) => (
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
        {selectedPersonalTag && (
          <span key={selectedPersonalTag.id} className="housing-tag-chip">
            {selectedPersonalTag.displayName}
            <button
              type="button"
              aria-label={t('housing.register.remove_tag')}
              onClick={() => toggle(selectedPersonalTag.id)}
              className="housing-tag-chip-remove"
            >
              ×
            </button>
          </span>
        )}
        {selectedCount > 0 && (
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
          {HOUSING_TAG_KINDS.map((kind) => (
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

      {!query && activeKind === 'personal' ? (
        <div className="housing-tag-picker-list" data-testid="housing-tag-picker-personal">
          {personalTagLoading && (
            <div className="housing-tag-picker-empty">{t('housing.register.personal_tag.loading')}</div>
          )}
          {!personalTagLoading && personalTagIsPublished && myPersonalTag && (
            <button
              type="button"
              disabled={!selected.includes(myPersonalTag.id) && isFull}
              aria-pressed={selected.includes(myPersonalTag.id)}
              onClick={() => toggle(myPersonalTag.id)}
              className="housing-tag-picker-option"
            >
              {myPersonalTag.displayName}
            </button>
          )}
          {!personalTagLoading && !personalTagIsPublished && (
            // 個人タグの作成・更新はハウジンガー公開に一本化 (タグ刷新 Phase B 統合契約1)。
            // ここでは名前入力フォームを出さず、 公開設定 (アカウントモーダル) への導線のみ示す。
            <div className="housing-tag-picker-personal-create">
              <p className="housing-address-note">{t('housing.register.personal_tag.not_published_hint')}</p>
              <button
                type="button"
                onClick={openAccount}
                className="housing-action-btn housing-btn-primary"
                data-testid="housing-personal-tag-open-account-button"
              >
                {t('housing.register.personal_tag.open_account_settings')}
              </button>
            </div>
          )}
        </div>
      ) : (
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
      )}
    </div>
  );
};
