import type { MockListing } from '../../../data/housing/mockListings';
import { useTranslation } from 'react-i18next';
import { Check, Image as ImageIcon } from 'lucide-react';

interface ListingCardTopLeftProps {
  listing: MockListing;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  isBackground?: boolean;
  onToggleBackground?: (id: string) => void;
  isPrivate: boolean;
  isExpired: boolean;
  showOwnerControls?: boolean;
}

/** ListingCard 左上の常時表示: 選択チェック・背景トグル・自分の登録の非公開/期限切れ印。 */
export const ListingCardTopLeft: React.FC<ListingCardTopLeftProps> = ({
  listing,
  selectable,
  selected,
  onToggleSelect,
  isBackground,
  onToggleBackground,
  isPrivate,
  isExpired,
  showOwnerControls,
}) => {
  const { t } = useTranslation();
  return (
        <div className="housing-listing-card-topleft">
          {selectable && (
            <button
              type="button"
              className={`housing-card-select${selected ? ' is-selected' : ''}`}
              aria-label={t('housing.card.select')}
              aria-pressed={selected ?? false}
              data-testid="housing-card-select"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.(listing.id);
              }}
            >
              {selected && <Check size={14} aria-hidden="true" />}
            </button>
          )}
          {selectable && selected && onToggleBackground && (
            <button
              type="button"
              className={`housing-card-background-select${isBackground ? ' is-selected' : ''}`}
              aria-label={t('housing.housinger.ogSelect.backgroundToggle')}
              aria-pressed={isBackground ?? false}
              data-testid="housing-card-background-select"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBackground(listing.id);
              }}
            >
              <ImageIcon size={13} aria-hidden="true" />
            </button>
          )}
          {((isPrivate && !showOwnerControls) || isExpired) && (
            <span className="housing-listing-card-mine-note" data-testid="housing-card-mine-note">
              {isPrivate ? t('housing.register.badge_private') : t('housing.register.badge_expired')}
            </span>
          )}
        </div>
  );
};
