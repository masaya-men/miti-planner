import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { GripVertical, X } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';

export interface TourBuilderItemProps {
    listing: MockListing;
    index: number;
    onRemove: () => void;
}

export const TourBuilderItem: React.FC<TourBuilderItemProps> = ({ listing, index, onRemove }) => {
    const { t } = useTranslation();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: listing.id,
    });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="housing-tour-builder-item">
            <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label={t('housing.workspace.tour_builder.drag_handle')}
                className="housing-tour-builder-grip"
            >
                <GripVertical size={14} aria-hidden="true" />
            </button>
            <span className="housing-tour-builder-index">{index + 1}.</span>
            <div className="housing-tour-builder-label">
                {listing.area} {listing.ward}-{listing.plot}
                <span className="housing-tour-builder-size">{listing.size}</span>
            </div>
            <button
                type="button"
                onClick={onRemove}
                aria-label={t('housing.workspace.tour_builder.remove')}
                className="housing-tour-builder-remove"
            >
                <X size={14} aria-hidden="true" />
            </button>
        </div>
    );
};
