import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CompressedImage } from '../../../lib/housing/imageCompression';
import { HousingImage } from '../media/HousingImage';

export interface SortableItem {
  id: string;
  img: CompressedImage;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(2)}MB`;
}

/** 1 枚分のサムネタイル (sortable wrapper)。 */
export function SortableImageTile({
  item,
  index,
  previewUrl,
  isCover,
  onRemove,
  coverBadgeLabel,
  removeLabel,
}: {
  item: SortableItem;
  index: number;
  previewUrl: string;
  isCover: boolean;
  onRemove: (index: number) => void;
  coverBadgeLabel: string;
  removeLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="housing-register-image-tile"
      data-dragging={isDragging}
      {...attributes}
      {...listeners}
    >
      {previewUrl && (
        <HousingImage src={previewUrl} className="housing-register-image-tile-img" draggable={false} />
      )}
      {isCover && (
        <span className="housing-register-image-tile-badge">{coverBadgeLabel}</span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        // PointerSensor が button の click を奪わないように pointerDown も止める
        onPointerDown={(e) => e.stopPropagation()}
        className="housing-register-image-tile-remove"
        aria-label={removeLabel}
      >
        ✕
      </button>
      <span className="housing-register-image-tile-meta">
        {formatBytes(item.img.compressedBytes)} (
        {item.img.mimeType.replace('image/', '').toUpperCase()})
      </span>
    </li>
  );
}

