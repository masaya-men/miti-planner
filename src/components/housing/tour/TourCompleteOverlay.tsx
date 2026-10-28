import { useTranslation } from 'react-i18next';
import './TourCompleteOverlay.css';

interface TourCompleteOverlayProps {
  onBackBrowse: () => void;
  onBackFavorites: () => void;
}

/**
 * ツアー中ページ(TourNavPage)の完了オーバーレイ。下の3パネルは inert のまま残し、その上に重ねる。
 * 閉じるボタンは持たず、「探す/お気に入りに戻る」のボタンで移動する。
 */
export const TourCompleteOverlay: React.FC<TourCompleteOverlayProps> = ({ onBackBrowse, onBackFavorites }) => {
  const { t } = useTranslation();
  return (
    <div
      className="housing-tour-complete-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="housing-tour-complete-title"
      data-testid="tour-complete-overlay"
    >
      <div className="housing-tour-complete-card">
        <h1 id="housing-tour-complete-title" className="housing-tour-complete-title">
          {t('housing.tour.nav.complete.title')}
        </h1>
        <p className="housing-tour-complete-lead">{t('housing.tour.nav.complete.lead')}</p>
        <div className="housing-tour-complete-actions">
          <button
            type="button"
            className="housing-tour-complete-btn housing-tour-complete-btn--primary"
            onClick={onBackBrowse}
          >
            {t('housing.tour.nav.complete.back_browse')}
          </button>
          <button type="button" className="housing-tour-complete-btn" onClick={onBackFavorites}>
            {t('housing.tour.nav.complete.back_favorites')}
          </button>
        </div>
      </div>
    </div>
  );
};
