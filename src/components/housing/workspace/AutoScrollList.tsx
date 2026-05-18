import { useRef, useState } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { useAutoScroll } from '../../../hooks/useAutoScroll';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';
import { RightPanelListItem } from './RightPanelListItem';

export interface AutoScrollListProps {
    listings: MockListing[];
    onItemClick?: (listing: MockListing) => void;
}

export const AutoScrollList: React.FC<AutoScrollListProps> = ({ listings, onItemClick }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [paused, setPaused] = useState(false);
    const reduced = useReducedMotion();
    useAutoScroll(ref, { pxPerSecond: 24, paused: paused || reduced, loop: true });

    return (
        <div
            ref={ref}
            data-paused={paused}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            className="housing-auto-scroll-list"
        >
            {listings.map((listing) => (
                <RightPanelListItem
                    key={listing.id}
                    listing={listing}
                    active={false}
                    onClick={() => onItemClick?.(listing)}
                />
            ))}
        </div>
    );
};
