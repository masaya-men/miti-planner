import { useState } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { HousingCard } from './HousingCard';
import { HousingCardExpanded } from './HousingCardExpanded';

export interface PinterestViewProps {
    listings: MockListing[];
}

export const PinterestView: React.FC<PinterestViewProps> = ({ listings }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

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
