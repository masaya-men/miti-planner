import { useTranslation } from 'react-i18next';
import { Plus, Check } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import type { useTourAddFeedback } from '../../../lib/housing/useTourAddFeedback';
import type { useRipple } from '../../../lib/housing/useRipple';
import { HousingRipple } from '../HousingRipple';
import { HousingTourAddErrorBubble } from '../HousingTourAddErrorBubble';

interface ListingCardTourAddFooterProps {
  listing: MockListing;
  onAddToTour: (id: string) => void;
  tourFeedback: ReturnType<typeof useTourAddFeedback>;
  addToTourBtnRef: React.RefObject<HTMLButtonElement | null>;
  ripples: ReturnType<typeof useRipple>['ripples'];
  addRipple: ReturnType<typeof useRipple>['onClick'];
}

/** ListingCard の画像に被らない常設フッターの「ツアーに追加」(footer 型)。 */
export const ListingCardTourAddFooter: React.FC<ListingCardTourAddFooterProps> = ({
  listing,
  onAddToTour,
  tourFeedback,
  addToTourBtnRef,
  ripples,
  addRipple,
}) => {
  const { t } = useTranslation();
  return (
        <div className="housing-listing-card-footer">
          <button
            ref={addToTourBtnRef}
            type="button"
            className={`housing-card-add-btn${tourFeedback.isAdded ? ' is-added' : ''}`}
            data-tour-anim={tourFeedback.animState}
            disabled={listing.visibility === 'unlisted'}
            aria-disabled={listing.visibility === 'unlisted'}
            aria-pressed={tourFeedback.isAdded}
            title={listing.visibility === 'unlisted' ? t('housing.card.addressPrivate') : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (listing.visibility === 'unlisted') return;
              addRipple(e);
              const outcome = tourFeedback.attemptToggle();
              if (outcome === 'added') onAddToTour(listing.id);
            }}
          >
            {tourFeedback.isAdded ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Plus size={14} aria-hidden="true" />
            )}
            {tourFeedback.isAdded ? t('housing.card.added_to_tour') : t('housing.card.add_to_tour')}
            <HousingRipple ripples={ripples} />
          </button>
          <HousingTourAddErrorBubble anchorRef={addToTourBtnRef} message={tourFeedback.errorMessage} />
        </div>
  );
};
