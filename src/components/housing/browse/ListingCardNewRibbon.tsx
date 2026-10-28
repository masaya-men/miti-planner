import type { MockListing } from '../../../data/housing/mockListings';
import { useTranslation } from 'react-i18next';
import { staggerDelayMs } from './newShineStagger';

interface ListingCardNewRibbonProps {
  listing: MockListing;
  showBeam: boolean;
  enterCount: number;
}

/** ListingCard 左上の NEW リボン (帯の上を光沢が通る)。 */
export const ListingCardNewRibbon: React.FC<ListingCardNewRibbonProps> = ({ listing, showBeam, enterCount }) => {
  const { t } = useTranslation();
  return (
          <span
            className="housing-card-new-ribbon"
            data-testid="housing-card-new-ribbon"
            aria-label={t('housing.card.new_badge_aria')}
          >
            {t('housing.card.new_badge')}
            {/* 帯の上だけを光沢がキラッと通る (2026-10-22 見本で決定・写真や縁には何も重ねない)。
                key={enterCount}: 画面内に入るたびに作り直して、もう一度最初から光らせる。
                ずらし値は CSS 変数 --beam-delay で animation-delay に渡す。 */}
            {showBeam && (
              <span
                key={enterCount}
                className="housing-card-new-shine"
                style={{ '--beam-delay': `${staggerDelayMs(listing.id)}ms` } as React.CSSProperties}
                aria-hidden="true"
              />
            )}
          </span>
  );
};
