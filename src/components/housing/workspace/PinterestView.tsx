import { useEffect, useState } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { HousingCard } from './HousingCard';
import { HousingCardExpanded } from './HousingCardExpanded';

export interface PinterestViewProps {
    listings: MockListing[];
    /** Pre-expand this listing id (e.g. from /housing/p/:listingId URL). */
    initialExpandedId?: string;
}

export const PinterestView: React.FC<PinterestViewProps> = ({ listings, initialExpandedId }) => {
    const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId ?? null);

    // Sync expansion when URL-driven prop changes (e.g. /housing/p/A → /housing/p/B without remount).
    useEffect(() => {
        if (initialExpandedId !== undefined) {
            setExpandedId(initialExpandedId);
        }
    }, [initialExpandedId]);

    return (
        <div className="housing-pinterest-grid">
            {listings.map((listing) => (
                <div key={listing.id} className="housing-pinterest-item">
                    {expandedId === listing.id ? (
                        <HousingCardExpanded
                            listing={listing}
                            onClose={() => setExpandedId(null)}
                        />
                    ) : (
                        <HousingCard
                            listing={listing}
                            onClick={() => setExpandedId(listing.id)}
                        />
                    )}
                </div>
            ))}
        </div>
    );
};
