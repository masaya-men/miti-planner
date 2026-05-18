import { useTranslation } from 'react-i18next';
import { SAMPLE_WARD_LAYOUT } from '../../../data/housing/sampleWardLayout';
import { MOCK_LISTINGS, type MockListing } from '../../../data/housing/mockListings';
import { MapBubbleCard } from './MapBubbleCard';

export interface MapViewProps {
    onCardClick: (listing: MockListing) => void;
}

const MAP_IMG_SRC = '/housing/maps/sample-ward.png';

export const MapView: React.FC<MapViewProps> = ({ onCardClick }) => {
    const { t } = useTranslation();

    return (
        <div className="housing-map-stage" data-region="map-stage">
            <div className="housing-map-canvas">
                <div className="housing-floor-grid" aria-hidden="true" />
                <div className="housing-map-wrap">
                    <img
                        className="housing-map-img"
                        src={MAP_IMG_SRC}
                        alt={t('housing.workspace.center.map_alt')}
                        loading="eager"
                    />
                    {SAMPLE_WARD_LAYOUT.map((plot) => {
                        if (!plot.listingId) return null;
                        const listing = MOCK_LISTINGS.find((l) => l.id === plot.listingId);
                        if (!listing) return null;
                        return (
                            <MapBubbleCard
                                key={`${plot.plot}-${listing.id}`}
                                listing={listing}
                                x={plot.x}
                                y={plot.y}
                                onClick={() => onCardClick(listing)}
                            />
                        );
                    })}
                </div>
            </div>

            <div className="housing-hud is-top">
                <div className="pill">N 31°.41 · E 22°.07</div>
                <div className="pill">
                    <span className="accent">●</span>
                    {' '}Route · 0 stops
                </div>
            </div>
            <div className="housing-hud is-bot">
                <div className="pill">Pattern M · 30 plots</div>
                <div className="pill">tilt 20° · grid 56px</div>
            </div>

            <svg
                className="housing-compass"
                viewBox="0 0 56 56"
                role="img"
                aria-label={t('housing.workspace.center.compass_label')}
            >
                <circle cx="28" cy="28" r="26" />
                <polygon className="needle" points="28,10 31,28 28,46 25,28" opacity="0.85" />
                <text className="n" x="28" y="7">N</text>
                <text x="50" y="29">E</text>
                <text x="28" y="52">S</text>
                <text x="6" y="29">W</text>
            </svg>
        </div>
    );
};
