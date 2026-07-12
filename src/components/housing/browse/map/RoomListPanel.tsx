import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import type { BrowseMapSpot } from '../../../../lib/housing/browseMapSpots';
import { splitSpotListings } from '../../../../lib/housing/browseMapSpots';
import { ListingCard } from '../ListingCard';

export interface RoomListPanelProps {
  spot: BrowseMapSpot;
  onClose: () => void;
  onAddToTour: (id: string) => void;
}

/**
 * 1スポット大量部屋の専用パネル (案B ②-b・spec §4)。地図に重なる A案。
 * spot.listings を家全体/個室/アパ部屋に振り分けてグリッド表示 (Firestore 再取得なし)。
 * FC個室 (家全体ちょうど1件 + 個室あり) は 家全体カードを上に、個室をグリッドに。
 * それ以外 (アパート / 家全体のみ / 重複登録) は全件グリッド。最大 512室 (個室) を想定し
 * content-visibility (ListingCard 内蔵) + contain-intrinsic-size (CSS) で軽く保つ。
 */
export const RoomListPanel: React.FC<RoomListPanelProps> = ({ spot, onClose, onAddToTour }) => {
  const { t } = useTranslation();
  const groups = splitSpotListings(spot);
  const isApartment = spot.kind === 'apart';
  const title = isApartment ? t('housing.map.apartment_label') : t('housing.map.plot_label', { plot: spot.plot });

  const fcLayout = !isApartment && groups.houseWholes.length === 1 && groups.chambers.length > 0;
  const gridListings = isApartment
    ? groups.apartmentRooms
    : fcLayout
      ? groups.chambers
      : [...groups.houseWholes, ...groups.chambers];

  return (
    <div className="housing-bmap-roompanel" data-testid="bmap-roompanel" role="dialog" aria-label={title}>
      <div className="housing-bmap-roompanel-header">
        <button type="button" className="housing-bmap-roompanel-back" onClick={onClose}>
          <ChevronLeft size={16} aria-hidden="true" />
          {t('housing.map.roompanel_back')}
        </button>
        <span className="housing-bmap-roompanel-title">{title}</span>
      </div>
      <div className="housing-bmap-roompanel-body">
        {fcLayout && (
          <>
            <div className="housing-bmap-roompanel-section-label">{t('housing.map.roompanel_house')}</div>
            <div className="housing-bmap-roompanel-house">
              <ListingCard listing={groups.houseWholes[0]} onAddToTour={onAddToTour} />
            </div>
            <div className="housing-bmap-roompanel-section-label">
              {t('housing.map.roompanel_chambers', { count: groups.chambers.length })}
            </div>
          </>
        )}
        <div className="housing-bmap-roompanel-grid">
          {gridListings.map((l) => (
            <ListingCard key={l.id} listing={l} onAddToTour={onAddToTour} />
          ))}
        </div>
      </div>
    </div>
  );
};
