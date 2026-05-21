import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import type { MockListing } from '../../../data/housing/mockListings';
import { RightPanelListItem } from './RightPanelListItem';
import { ShareTourButton } from './ShareTourButton';

export interface TourProgressListProps {
    tourId: string;
}

export const TourProgressList: React.FC<TourProgressListProps> = ({ tourId }) => {
    const { t } = useTranslation();
    const listingIds = useHousingTourStore((s) => s.listingIds);
    const currentIndex = useHousingTourStore((s) => s.currentIndex);
    const stopTour = useHousingTourStore((s) => s.stop);
    const exitTourMode = useHousingViewStore((s) => s.exitTourMode);
    const allListings = useHousingListingsStore((s) => s.listings);
    const listRef = useRef<HTMLDivElement>(null);

    const listings = useMemo(
        () => listingIds
            .map((id) => allListings.find((l) => l.id === id))
            .filter((l): l is MockListing => Boolean(l)),
        [listingIds, allListings],
    );

    // Scroll the active item into view on every step change.
    useEffect(() => {
        const root = listRef.current;
        if (!root) return;
        const active = root.querySelector('[data-active="true"]') as HTMLElement | null;
        if (active) {
            active.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentIndex]);

    const handleExit = () => {
        stopTour();
        exitTourMode();
    };

    return (
        <div className="housing-tour-progress">
            <div className="housing-tour-progress-head">
                <ShareTourButton tourId={tourId} />
                <button
                    type="button"
                    onClick={handleExit}
                    aria-label={t('housing.workspace.tour.exit_aria')}
                    className="housing-tour-exit-btn"
                >
                    <LogOut size={14} aria-hidden="true" />
                    <span>{t('housing.workspace.tour.exit')}</span>
                </button>
            </div>
            <div className="housing-tour-progress-meta">
                <span className="housing-tour-progress-step">
                    {currentIndex + 1} / {listings.length}
                </span>
                <span className="housing-tour-progress-status">{t('housing.workspace.tour.progress')}</span>
            </div>
            <div ref={listRef} className="housing-tour-progress-list">
                {listings.map((listing, i) => (
                    <RightPanelListItem
                        key={listing.id}
                        listing={listing}
                        active={i === currentIndex}
                        onClick={() => { /* Plan E: jump to that step */ }}
                    />
                ))}
            </div>
        </div>
    );
};
