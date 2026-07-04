import { useTranslation } from 'react-i18next';

export interface TourEmptyStateProps {
  onGoFavorites: () => void;
}

/**
 * ツアー未開始の空状態 (表示専用)。
 * タイトル + リード文 + 「お気に入りへ」CTA のみの、ヘアライン注記的な静かな空状態。
 * 装飾ピル/honeyグラデ/色付きalert箱は使わない (housing-design.md 質感A案)。
 * store 配線・ナビゲーションの中身は TourNavPage (Task8) が onGoFavorites 経由で担う。
 */
export const TourEmptyState: React.FC<TourEmptyStateProps> = ({ onGoFavorites }) => {
  const { t } = useTranslation();

  return (
    <div className="housing-tour-empty">
      <p className="housing-tour-empty-title">{t('housing.tour.nav.empty.title')}</p>
      <p className="housing-tour-empty-lead">{t('housing.tour.nav.empty.lead')}</p>
      <button type="button" className="housing-tour-empty-cta" onClick={onGoFavorites}>
        {t('housing.tour.nav.empty.cta')}
      </button>
    </div>
  );
};
