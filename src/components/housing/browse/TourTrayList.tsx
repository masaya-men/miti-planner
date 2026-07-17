import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, ArrowDownUp, ArrowUpToLine, GripVertical, Route, X } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import { useTourTrayStore } from '../../../store/useTourTrayStore';
import { resolveTourOrder } from '../../../lib/housing/resolveTourOrder';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { canDisplayAddress } from '../../../lib/housing/listingPublish';
import { isEphemeralListingId } from '../../../lib/housing/ephemeralListing';
import type { MockListing } from '../../../data/housing/mockListings';

export interface TourTrayListProps {
  /** トレイの生 id 配列 (追加順 or 前回の手動並び替え順)。表示順の解決は内部で行う。 */
  listingIds: string[];
  /** 削除 / ドラッグ確定 / 効率順ボタンで trayIds 全体を更新する。 */
  onChange: (ids: string[]) => void;
}

/**
 * ツアートレイの行き先リスト本体 (ツアー順制御: ドラッグ並び替え + 最初/最後固定ピン + 効率順ボタン)。
 * PC (TourTray 右パネル) とスマホ (並べ替えボトムシート) で共有する。
 *
 * 表示順は resolveTourOrder の結果 = 実際のツアー開始順と常に一致する (番号=巡回順)。
 */
export const TourTrayList: React.FC<TourTrayListProps> = ({ listingIds, onChange }) => {
  const { t, i18n } = useTranslation();
  const listings = useHousingListingsStore((s) => s.listings);
  const myListings = useHousingListingsStore((s) => s.myListings);
  const ephemeral = useEphemeralListingsStore((s) => s.ephemeralListings);

  const pinnedFirstId = useTourTrayStore((s) => s.pinnedFirstId);
  const pinnedLastId = useTourTrayStore((s) => s.pinnedLastId);
  const manualOrder = useTourTrayStore((s) => s.manualOrder);
  const setPinnedFirstId = useTourTrayStore((s) => s.setPinnedFirstId);
  const setPinnedLastId = useTourTrayStore((s) => s.setPinnedLastId);
  const setManualOrder = useTourTrayStore((s) => s.setManualOrder);

  // 行解決プール: 公開一覧 → 自分の登録 → 一時 listing (TourTray と同じ合流)。
  const pool = [...listings, ...myListings, ...ephemeral];
  const orderedIds = resolveTourOrder(listingIds, pool, { pinnedFirstId, pinnedLastId, manualOrder });

  const items = orderedIds
    .map(
      (id) =>
        listings.find((l) => l.id === id) ??
        myListings.find((l) => l.id === id) ??
        ephemeral.find((l) => l.id === id),
    )
    .filter((l): l is MockListing => Boolean(l));
  const displayedIds = items.map((l) => l.id);

  const remove = (id: string) => {
    onChange(listingIds.filter((x) => x !== id));
    if (pinnedFirstId === id) setPinnedFirstId(null);
    if (pinnedLastId === id) setPinnedLastId(null);
  };

  const togglePinFirst = (id: string) => setPinnedFirstId(pinnedFirstId === id ? null : id);
  const togglePinLast = (id: string) => setPinnedLastId(pinnedLastId === id ? null : id);

  const onSortEfficient = () => {
    const next = resolveTourOrder(listingIds, pool, { pinnedFirstId, pinnedLastId, manualOrder: false });
    onChange(next);
    setManualOrder(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = displayedIds.indexOf(String(active.id));
    const newIndex = displayedIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(displayedIds, oldIndex, newIndex));
    setManualOrder(true);
  };

  if (items.length === 0) {
    return (
      <div className="housing-empty-hint housing-tour-tray-empty">
        <Route size={20} aria-hidden="true" />
        <p>{t('housing.tray.empty')}</p>
      </div>
    );
  }

  return (
    <div className="housing-tour-tray-body">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayedIds} strategy={verticalListSortingStrategy}>
          <ol className="housing-tour-tray-list">
            {items.map((l, i) => (
              <TourTrayRow
                key={l.id}
                listing={l}
                index={i}
                language={i18n.language}
                isPinnedFirst={pinnedFirstId === l.id}
                isPinnedLast={pinnedLastId === l.id}
                onRemove={remove}
                onTogglePinFirst={togglePinFirst}
                onTogglePinLast={togglePinLast}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <button type="button" className="housing-tour-tray-sortbtn" onClick={onSortEfficient}>
        <ArrowDownUp size={14} aria-hidden="true" />
        {t('housing.tray.sort_efficient')}
      </button>
    </div>
  );
};

interface TourTrayRowProps {
  listing: MockListing;
  index: number;
  language: string;
  isPinnedFirst: boolean;
  isPinnedLast: boolean;
  onRemove: (id: string) => void;
  onTogglePinFirst: (id: string) => void;
  onTogglePinLast: (id: string) => void;
}

/** 1 行分 (sortable wrapper)。ドラッグは左端の GripVertical ハンドルだけで発動する (行全体は不可)。 */
function TourTrayRow({
  listing,
  index,
  language,
  isPinnedFirst,
  isPinnedLast,
  onRemove,
  onTogglePinFirst,
  onTogglePinLast,
}: TourTrayRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listing.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="housing-tour-tray-item" data-dragging={isDragging}>
      <button
        type="button"
        className="housing-tour-tray-drag"
        aria-label={t('housing.tray.drag_handle')}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>
      <span className="housing-tour-tray-num">{index + 1}</span>
      <span className="housing-tour-tray-addr">
        {listing.visibility === 'private'
          ? t('housing.card.privateListing')
          : canDisplayAddress(listing)
            ? formatHousingAddress(listing, language)
            : t('housing.card.addressPrivate')}
      </span>
      {isEphemeralListingId(listing.id) && (
        <span className="housing-ephemeral-badge">{t('housing.ephemeral.badge')}</span>
      )}
      <button
        type="button"
        className="housing-tour-tray-pin"
        data-active={isPinnedFirst}
        aria-pressed={isPinnedFirst}
        aria-label={isPinnedFirst ? t('housing.tray.unpin') : t('housing.tray.pin_first')}
        onClick={() => onTogglePinFirst(listing.id)}
      >
        <ArrowUpToLine size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="housing-tour-tray-pin"
        data-active={isPinnedLast}
        aria-pressed={isPinnedLast}
        aria-label={isPinnedLast ? t('housing.tray.unpin') : t('housing.tray.pin_last')}
        onClick={() => onTogglePinLast(listing.id)}
      >
        <ArrowDownToLine size={14} aria-hidden="true" />
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
