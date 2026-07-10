import { useTranslation } from 'react-i18next';
import type { HousingBrowseView } from '../../../store/useHousingViewStore';

export interface BrowseViewToggleProps {
  value: HousingBrowseView;
  onChange: (v: HousingBrowseView) => void;
}

const VIEWS: HousingBrowseView[] = ['list', 'map'];

/**
 * 探す中央パネル上部の「一覧 | 地図」切替 (spec 3.1)。
 * `ListingGrid.tsx` に温存されていた設計位置を、中央カラムの上部 (トグル + 分岐) として実装する。
 */
export const BrowseViewToggle: React.FC<BrowseViewToggleProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const labelOf = (v: HousingBrowseView) => t(`housing.browse.view_${v}`);

  return (
    <div className="housing-view-toggle" role="tablist" aria-label={t('housing.browse.view_aria')}>
      {VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          data-selected={value === v ? 'true' : 'false'}
          className="housing-view-toggle-btn"
          onClick={() => onChange(v)}
        >
          {labelOf(v)}
        </button>
      ))}
    </div>
  );
};
