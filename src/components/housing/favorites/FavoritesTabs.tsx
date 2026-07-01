import { useTranslation } from 'react-i18next';
import type { FavTab } from './favoritesOrder';

export interface FavoritesTabsProps {
  tab: FavTab;
  onChange: (t: FavTab) => void;
  counts: { all: number; recent: number };
}

const TABS: { key: FavTab; i18nKey: string }[] = [
  { key: 'all', i18nKey: 'housing.favorites.tab_all' },
  { key: 'recent', i18nKey: 'housing.favorites.tab_recent' },
];

/**
 * お気に入りページの並び順タブ (すべて / 最近追加)。
 * アクティブタブはハニー下線 (--housing-tab-active) で強調。
 * counts prop は plan 準拠で受けるが、 両タブは同じ全お気に入り集合を出すため
 * 総数は中央見出しに 1 回だけ表示し、 タブ内には出さない (冗長回避)。
 */
export const FavoritesTabs: React.FC<FavoritesTabsProps> = ({ tab, onChange }) => {
  const { t } = useTranslation();

  return (
    <div className="housing-fav-tabs" role="tablist">
      {TABS.map(({ key, i18nKey }) => (
        <button
          key={key}
          role="tab"
          aria-selected={tab === key}
          className="housing-fav-tab"
          onClick={() => onChange(key)}
          type="button"
        >
          {t(i18nKey)}
        </button>
      ))}
    </div>
  );
};
