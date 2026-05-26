import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, Plus, Link as LinkIcon, ExternalLink, X } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';

const PLACEHOLDER = '/housing/mock-thumbs/placeholder.svg';

export interface HousingCardExpandedProps {
    listing: MockListing;
    onClose: () => void;
}

function resolveImageSource(listing: MockListing): string {
    if (listing.imageMode === 'thumbnail' && listing.thumbnailPath) return listing.thumbnailPath;
    if (listing.imageMode === 'sns' && listing.ogImageUrl) return listing.ogImageUrl;
    return PLACEHOLDER;
}

export const HousingCardExpanded: React.FC<HousingCardExpandedProps> = ({ listing, onClose }) => {
    const { t, i18n } = useTranslation();
    const isFavorite = useHousingFavoritesStore((s) => s.ids.includes(listing.id));
    const addFavorite = useHousingFavoritesStore((s) => s.add);
    const removeFavorite = useHousingFavoritesStore((s) => s.remove);
    const [copyState, setCopyState] = useState<'idle' | 'done'>('idle');

    const imgSrc = resolveImageSource(listing);
    const addr = `${listing.dc} / ${listing.server} / ${formatHousingAddress(listing, i18n.language)}`;
    const isApartment = listing.buildingType === 'apartment';

    const toggleFavorite = () => {
        if (isFavorite) removeFavorite(listing.id);
        else addFavorite(listing.id);
    };

    const copyShareUrl = async () => {
        try {
            const url = typeof window !== 'undefined'
                ? `${window.location.origin}/housing/p/${listing.id}`
                : `/housing/p/${listing.id}`;
            await navigator.clipboard.writeText(url);
            setCopyState('done');
            window.setTimeout(() => setCopyState('idle'), 1800);
        } catch {
            // clipboard unavailable; silently no-op (Plan F adds toast)
        }
    };

    return (
        <div className="housing-card-expanded">
            <div className="housing-card-expanded-thumb">
                <img src={imgSrc} alt="" loading="lazy" />
            </div>
            <div className="housing-card-expanded-body">
                <div className="housing-card-expanded-head">
                    <div className="housing-card-expanded-title">
                        {addr}
                        {!isApartment && listing.size && (
                            <span className="housing-card-size"> {listing.size}</span>
                        )}
                    </div>
                    <button
                        type="button"
                        className="housing-action-btn is-icon"
                        aria-label={t('housing.workspace.card.close')}
                        onClick={onClose}
                    >
                        <X size={14} aria-hidden="true" />
                    </button>
                </div>

                {listing.description && (
                    <p className="housing-card-expanded-desc">{listing.description}</p>
                )}

                <div className="housing-card-tags">
                    {listing.tags.map((tag) => (
                        <span key={tag} className="housing-card-tag">{tag}</span>
                    ))}
                </div>

                <div className="housing-card-expanded-actions">
                    <button
                        type="button"
                        className="housing-action-btn"
                        data-active={isFavorite}
                        aria-label={isFavorite
                            ? t('housing.workspace.card.favorite_remove')
                            : t('housing.workspace.card.favorite')}
                        aria-pressed={isFavorite}
                        onClick={toggleFavorite}
                    >
                        <Heart
                            size={14}
                            aria-hidden="true"
                            fill={isFavorite ? 'currentColor' : 'none'}
                        />
                        <span>{t('housing.workspace.card.favorite')}</span>
                    </button>

                    <button
                        type="button"
                        className="housing-action-btn"
                        aria-label={t('housing.workspace.card.add_to_tour')}
                    >
                        <Plus size={14} aria-hidden="true" />
                        <span>{t('housing.workspace.card.add_to_tour')}</span>
                    </button>

                    <button
                        type="button"
                        className="housing-action-btn is-icon"
                        aria-label={copyState === 'done'
                            ? t('housing.workspace.card.copy_url_done')
                            : t('housing.workspace.card.copy_url')}
                        onClick={copyShareUrl}
                    >
                        <LinkIcon size={14} aria-hidden="true" />
                    </button>

                    {listing.postUrl && (
                        <a
                            href={listing.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="housing-action-btn is-icon"
                            aria-label={t('housing.workspace.card.open_sns')}
                        >
                            <ExternalLink size={14} aria-hidden="true" />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};
