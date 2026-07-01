import { useTranslation } from 'react-i18next';

export interface FavoritesBulkBarProps {
  total: number;
  selectedCount: number;
  onSelectAll: () => void;
  onClearSelect: () => void;
  onAddAll: () => void;
  onAddSelected: () => void;
  onRemoveFromFav: () => void;
}

/**
 * お気に入りページ中央の一括操作バー。
 * - すべて選択 / 選択解除 / すべてツアーに追加 / 選択だけ追加 / お気に入りから外す
 * - selectedCount===0 のとき「選択解除・選択だけ追加・お気に入りから外す」を disabled
 * - 選択中は件数バッジを表示
 */
export const FavoritesBulkBar: React.FC<FavoritesBulkBarProps> = ({
  total,
  selectedCount,
  onSelectAll,
  onClearSelect,
  onAddAll,
  onAddSelected,
  onRemoveFromFav,
}) => {
  const { t } = useTranslation();
  const hasSelection = selectedCount > 0;

  return (
    <div className="housing-fav-bulkbar" aria-label={t('housing.favorites.bulk_bar_aria', { defaultValue: '一括操作' })}>
      {hasSelection && (
        <span className="housing-fav-bulkbar-count">
          {t('housing.favorites.bulk_selected_count', { count: selectedCount })}
        </span>
      )}

      <div className="housing-fav-bulkbar-actions">
        {/* 左グループ: 選択制御 */}
        <div className="housing-fav-bulkbar-group">
          <button
            type="button"
            className="housing-fav-bulkbar-btn"
            onClick={onSelectAll}
            disabled={total === 0}
          >
            {t('housing.favorites.bulk_select_all')}
          </button>
          <button
            type="button"
            className="housing-fav-bulkbar-btn"
            onClick={onClearSelect}
            disabled={!hasSelection}
          >
            {t('housing.favorites.bulk_clear')}
          </button>
        </div>

        {/* 右グループ: ツアー追加 + 外す (主要導線 = ハニー) */}
        <div className="housing-fav-bulkbar-group">
          <button
            type="button"
            className="housing-fav-bulkbar-btn housing-fav-bulkbar-btn--primary"
            onClick={onAddAll}
            disabled={total === 0}
          >
            {t('housing.favorites.bulk_add_all')}
          </button>
          <button
            type="button"
            className="housing-fav-bulkbar-btn housing-fav-bulkbar-btn--accent"
            onClick={onAddSelected}
            disabled={!hasSelection}
          >
            {t('housing.favorites.bulk_add_selected')}
          </button>
          <button
            type="button"
            className="housing-fav-bulkbar-btn housing-fav-bulkbar-btn--danger"
            onClick={onRemoveFromFav}
            disabled={!hasSelection}
          >
            {t('housing.favorites.bulk_remove')}
          </button>
        </div>
      </div>
    </div>
  );
};
