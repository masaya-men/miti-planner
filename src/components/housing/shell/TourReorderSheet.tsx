import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { MobileBottomSheet } from '../../MobileBottomSheet';
import { TourTrayList } from '../browse/TourTrayList';

export interface TourReorderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  listingIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * スマホ用「並べ替え」ボトムシート (ツアー順制御: ドラッグ並び替え + 最初/最後固定ピン + 効率順ボタン)。
 * MobileTourTrayBar の並べ替えボタンから開く。中身は PC の TourTray と同じ TourTrayList を共有するため、
 * 挙動 (ドラッグ/ピン/効率順) は PC と完全に同一になる。
 */
export const TourReorderSheet: React.FC<TourReorderSheetProps> = ({
  isOpen,
  onClose,
  listingIds,
  onChange,
}) => {
  const { t } = useTranslation();

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      height="80vh"
      className="housing-mobile-sheet"
      swipeArea="handle"
    >
      <div className="housing-sheet-head">
        <span className="housing-sheet-title">{t('housing.mobile.reorder')}</span>
        <button
          type="button"
          className="housing-sheet-close"
          onClick={onClose}
          aria-label={t('housing.card.close')}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <TourTrayList listingIds={listingIds} onChange={onChange} />
    </MobileBottomSheet>
  );
};
