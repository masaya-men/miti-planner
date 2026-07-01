import { useTranslation } from 'react-i18next';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';

/**
 * お気に入りページ (3カラム): 左=オンボ(後続タスク) / 中央=お気に入りグリッド / 右=トレイ(後続タスク)。
 * Task2 はカラム骨組みと空状態のみ。中身は後続 Task3〜7 で埋める。
 */
export const FavoritesPage: React.FC = () => {
  const { t } = useTranslation();
  const ids = useHousingFavoritesStore((s) => s.ids);

  return (
    <div className="housing-browse">
      {/* 左カラム: オンボーディング (Task6 で実装) */}
      <section className="housing-browse-panel" data-region="left">
        <div className="housing-browse-col housing-browse-col-left" />
      </section>

      {/* 中央カラム: お気に入りグリッド */}
      <section className="housing-browse-panel" data-region="center">
        <div className="housing-browse-col housing-browse-col-center">
          {ids.length === 0 ? (
            <div
              className="housing-center-loading"
              data-testid="housing-favorites-empty"
            >
              {t('housing.favorites.empty')}
            </div>
          ) : (
            <div className="housing-center-loading">
              {t('housing.favorites.title')}
            </div>
          )}
        </div>
      </section>

      {/* 右カラム: トレイ (後続タスクで実装) */}
      <section className="housing-browse-panel" data-region="right">
        <div className="housing-browse-col housing-browse-col-right" />
      </section>
    </div>
  );
};
