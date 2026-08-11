import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GripVertical, Pin, Route, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { canDisplayAddress } from '../../../lib/housing/listingPublish';
import { isEphemeralListingId } from '../../../lib/housing/ephemeralListing';
import { representativeImage, hasRepresentativeImage } from '../../../lib/housing/representativeImage';
import type { MockListing } from '../../../data/housing/mockListings';

export interface TourTrayRowProps {
  listing: MockListing;
  language: string;
  isPinned: boolean;
  onRemove: (id: string) => void;
  onTogglePin: (id: string) => void;
}

/**
 * トレイの行き先1行分 (sortable wrapper)。ドラッグは左端の GripVertical ハンドルだけで発動する。
 * PC サイドバー (TourTrayList) とスマホの計画画面、蛇行グリッド (TourTrayBoard) で共用する。
 */
export function TourTrayRow({
  listing,
  language,
  isPinned,
  onRemove,
  onTogglePin,
}: TourTrayRowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listing.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // 住所は表示しないが、タイトル未入力時のフォールバック文言として内部計算だけは残す。
  const addr =
    listing.visibility === 'private'
      ? t('housing.card.privateListing')
      : canDisplayAddress(listing)
        ? formatHousingAddress(listing, language)
        : t('housing.card.addressPrivate');
  const title = listing.title?.trim() || addr;

  const isEphemeral = isEphemeralListingId(listing.id);
  const showThumbImage = !isEphemeral && hasRepresentativeImage(listing);
  const thumb = showThumbImage ? (
    <img className="housing-tour-tray-thumb" src={representativeImage(listing)} alt="" loading="lazy" />
  ) : (
    <span className="housing-tour-tray-thumb housing-tour-tray-thumb-placeholder" aria-hidden="true">
      <Route size={16} aria-hidden="true" />
    </span>
  );

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="housing-tour-tray-item"
      data-dragging={isDragging}
      title={title}
    >
      <button
        type="button"
        className="housing-tour-tray-drag"
        aria-label={t('housing.tray.drag_handle')}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>
      {isEphemeral ? (
        thumb
      ) : (
        <button
          type="button"
          className="housing-tour-tray-thumb-btn"
          aria-label={t('housing.tray.open_detail')}
          onClick={() => navigate(`/housing/listing/${listing.id}`)}
        >
          {thumb}
        </button>
      )}
      <span className="housing-tour-tray-info">
        <span className="housing-tour-tray-title">{title}</span>
      </span>
      {isEphemeral && (
        <span className="housing-ephemeral-badge">{t('housing.ephemeral.badge')}</span>
      )}
      <button
        type="button"
        className="housing-tour-tray-pin"
        data-active={isPinned}
        aria-pressed={isPinned}
        aria-label={isPinned ? t('housing.tray.unpin') : t('housing.tray.pin')}
        onClick={() => onTogglePin(listing.id)}
      >
        <Pin size={14} aria-hidden="true" fill={isPinned ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        className="housing-tour-tray-remove"
        aria-label={t('housing.tray.remove')}
        onClick={() => onRemove(listing.id)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </li>
  );
}
