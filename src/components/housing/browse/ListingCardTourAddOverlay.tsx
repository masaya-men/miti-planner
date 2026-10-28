import { useTranslation } from 'react-i18next';
import { Plus, Check } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import type { useTourAddFeedback } from '../../../lib/housing/useTourAddFeedback';
import type { useRipple } from '../../../lib/housing/useRipple';
import { HousingRipple } from '../HousingRipple';
import { HousingTourAddErrorBubble } from '../HousingTourAddErrorBubble';

interface ListingCardTourAddOverlayProps {
  listing: MockListing;
  onAddToTour: (id: string) => void;
  tourFeedback: ReturnType<typeof useTourAddFeedback>;
  addToTourBtnRef: React.RefObject<HTMLButtonElement | null>;
  ripples: ReturnType<typeof useRipple>['ripples'];
  addRipple: ReturnType<typeof useRipple>['onClick'];
}

/** ListingCard の画像上「ツアーに追加」(overlay 型): 追加済みの印+ボタン+エラー吹き出し。 */
export const ListingCardTourAddOverlay: React.FC<ListingCardTourAddOverlayProps> = ({
  listing,
  onAddToTour,
  tourFeedback,
  addToTourBtnRef,
  ripples,
  addRipple,
}) => {
  const { t } = useTranslation();
  return (
    <>
        {/* overlay: 追加済みの印 (ホバー無しでも常時・タッチ端末では＋が✓に変わるので CSS で隠す) */}
        {tourFeedback.isAdded && (
          <span className="housing-listing-card-added-mark" data-testid="housing-card-added-mark">
            {t('housing.card.added_mark')}
          </span>
        )}
        {/* overlay: ボタンは 1 個。PC=下端の帯 / タッチ=右下の丸＋ を CSS のメディアクエリで切替える。 */}
          <>
            <button
              ref={addToTourBtnRef}
              type="button"
              className={`housing-card-add-overlay${tourFeedback.isAdded ? ' is-added' : ''}`}
              data-tour-anim={tourFeedback.animState}
              data-testid="housing-card-add-overlay"
              aria-pressed={tourFeedback.isAdded}
              aria-label={tourFeedback.isAdded ? t('housing.card.added_to_tour') : t('housing.card.add_to_tour')}
              onClick={(e) => {
                e.stopPropagation();
                addRipple(e);
                const outcome = tourFeedback.attemptToggle();
                if (outcome === 'added') onAddToTour(listing.id);
              }}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {tourFeedback.isAdded ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Plus size={14} aria-hidden="true" />
              )}
              <span className="housing-card-add-overlay-label">
                {tourFeedback.isAdded ? t('housing.card.added_to_tour') : t('housing.card.add_to_tour')}
              </span>
              <HousingRipple ripples={ripples} />
            </button>
            <HousingTourAddErrorBubble anchorRef={addToTourBtnRef} message={tourFeedback.errorMessage} />
          </>
    </>
  );
};
