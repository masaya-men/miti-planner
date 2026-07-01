import { useTranslation } from 'react-i18next';
import { Heart, Plus } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';

export interface ListingCardProps {
  listing: MockListing;
  onAddToTour: (id: string) => void;
}

// 代表画像が無い/未取得のときのフォールバック (既存カードと共通)。
const PLACEHOLDER = '/housing/mock-thumbs/1.svg';

function representativeImage(l: MockListing): string {
  if (l.imageMode === 'thumbnail' && l.thumbnailPath) return l.thumbnailPath;
  if (l.imageMode === 'sns' && l.ogImageUrl) return l.ogImageUrl;
  return PLACEHOLDER;
}

/**
 * 探す / お気に入り / マイページ 共通のグリッドカード (生きたカード)。
 * 段階1: 静止代表画像 + ホバー演出。段階2 で HousingPlaybackProvider を
 * シェルに足すと spotlight 動画再生が有効化される (既存 card 再生機構を流用予定)。
 */
export const ListingCard: React.FC<ListingCardProps> = ({ listing, onAddToTour }) => {
  const { t, i18n } = useTranslation();
  const favIds = useHousingFavoritesStore((s) => s.ids);
  const addFav = useHousingFavoritesStore((s) => s.add);
  const removeFav = useHousingFavoritesStore((s) => s.remove);
  const isFav = favIds.includes(listing.id);

  const title = formatHousingAddress(listing, i18n.language);
  const isApartment = listing.buildingType === 'apartment';

  return (
    <article className="housing-listing-card" style={{ contentVisibility: 'auto' } as React.CSSProperties}>
      <div className="housing-listing-card-media">
        <img
          className="housing-listing-card-img"
          src={representativeImage(listing)}
          alt=""
          loading="lazy"
        />
        <button
          type="button"
          className={`housing-card-fav${isFav ? ' is-on' : ''}`}
          aria-label={t('housing.card.favorite')}
          aria-pressed={isFav}
          onClick={() => (isFav ? removeFav(listing.id) : addFav(listing.id))}
        >
          <Heart size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="housing-listing-card-body">
        <div className="housing-listing-card-title">
          <span>{title}</span>
          {!isApartment && listing.size && (
            <span className="housing-listing-card-size">{listing.size}</span>
          )}
        </div>
        {listing.tags.length > 0 && (
          <div className="housing-listing-card-tags">
            {listing.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="housing-pill">{tag}</span>
            ))}
          </div>
        )}
        <button
          type="button"
          className="housing-card-add-btn"
          onClick={() => onAddToTour(listing.id)}
        >
          <Plus size={14} aria-hidden="true" />
          {t('housing.card.add_to_tour')}
        </button>
      </div>
    </article>
  );
};
