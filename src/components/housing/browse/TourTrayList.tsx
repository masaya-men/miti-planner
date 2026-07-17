import { useTranslation } from 'react-i18next';
import { ArrowDownUp, GripVertical, Pin, Route, X } from 'lucide-react';
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
import { representativeImage, hasRepresentativeImage } from '../../../lib/housing/representativeImage';
import type { MockListing } from '../../../data/housing/mockListings';

export interface TourTrayListProps {
  /** トレイの生 id 配列 (追加順 or 前回の手動並び替え順)。表示順の解決は内部で行う。 */
  listingIds: string[];
  /** 削除 / ドラッグ確定 / 効率順ボタンで trayIds 全体を更新する。 */
  onChange: (ids: string[]) => void;
}

/**
 * ツアートレイの行き先リスト本体 (ツアー順制御: ドラッグ並び替え + ピン留め + 効率順ボタン)。
 * PC (TourTray 右パネル) とスマホ (並べ替えボトムシート) で共有する。
 *
 * 表示順は resolveTourOrder の結果 = 実際のツアー開始順と常に一致する (番号=巡回順)。
 *
 * 2026-07-17 実機FB反映:
 * (a) 行が住所だけで見分けづらい → サムネ+タイトルを追加。
 * (b) 「最初に固定/最後に固定」の2ボタンが分かりづらい → ピン1個の「この位置に固定」に統一。
 */
export const TourTrayList: React.FC<TourTrayListProps> = ({ listingIds, onChange }) => {
  const { t, i18n } = useTranslation();
  const listings = useHousingListingsStore((s) => s.listings);
  const myListings = useHousingListingsStore((s) => s.myListings);
  const ephemeral = useEphemeralListingsStore((s) => s.ephemeralListings);

  const pinnedIds = useTourTrayStore((s) => s.pinnedIds);
  const manualOrder = useTourTrayStore((s) => s.manualOrder);
  const togglePinStore = useTourTrayStore((s) => s.togglePin);
  const setManualOrder = useTourTrayStore((s) => s.setManualOrder);

  // 行解決プール: 公開一覧 → 自分の登録 → 一時 listing (TourTray と同じ合流)。
  const pool = [...listings, ...myListings, ...ephemeral];
  const orderedIds = resolveTourOrder(listingIds, pool, { pinnedIds, manualOrder });

  const items = orderedIds
    .map(
      (id) =>
        listings.find((l) => l.id === id) ??
        myListings.find((l) => l.id === id) ??
        ephemeral.find((l) => l.id === id),
    )
    .filter((l): l is MockListing => Boolean(l));
  // 書き戻し用の並びは「全 id の順列」を使う (items 由来だと、ストア読み込み中などで
  // 解決できない行き先がピン/ドラッグ/効率順の書き戻しで静かにトレイから消える)。
  // 未解決 id は行として描画されないだけで、順序上の位置は温存される。
  const displayedIds = orderedIds;

  const remove = (id: string) => {
    onChange(listingIds.filter((x) => x !== id));
    if (pinnedIds.includes(id)) togglePinStore(id);
  };

  // ピン留め: 表示中の並び (resolveTourOrder の結果) をまず実体化してからピンを立てる
  // = 見えている位置がそのまま固定位置になる。manualOrder は変えない。
  const togglePin = (id: string) => {
    onChange(displayedIds);
    togglePinStore(id);
  };

  const onSortEfficient = () => {
    const next = resolveTourOrder(listingIds, pool, { pinnedIds, manualOrder: false });
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
                isPinned={pinnedIds.includes(l.id)}
                onRemove={remove}
                onTogglePin={togglePin}
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
  isPinned: boolean;
  onRemove: (id: string) => void;
  onTogglePin: (id: string) => void;
}

/** 1 行分 (sortable wrapper)。ドラッグは左端の GripVertical ハンドルだけで発動する (行全体は不可)。 */
function TourTrayRow({
  listing,
  index,
  language,
  isPinned,
  onRemove,
  onTogglePin,
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

  // 2行目: 住所 (非公開系の分岐は既存のまま維持)。
  const addr =
    listing.visibility === 'private'
      ? t('housing.card.privateListing')
      : canDisplayAddress(listing)
        ? formatHousingAddress(listing, language)
        : t('housing.card.addressPrivate');
  // 1行目: 登録者のタイトル。未入力 (旧データ) は住所 (上と同じ文言) にフォールバック。
  const title = listing.title?.trim() || addr;

  // サムネ: 一時 listing (ephemeral) と実画像を持たない listing は Route アイコンのプレースホルダ枠。
  const showThumbImage = !isEphemeralListingId(listing.id) && hasRepresentativeImage(listing);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="housing-tour-tray-item"
      data-dragging={isDragging}
      title={`${title}\n${addr}`}
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
      <span className="housing-tour-tray-num">{index + 1}</span>
      {showThumbImage ? (
        <img className="housing-tour-tray-thumb" src={representativeImage(listing)} alt="" loading="lazy" />
      ) : (
        <span className="housing-tour-tray-thumb housing-tour-tray-thumb-placeholder" aria-hidden="true">
          <Route size={16} aria-hidden="true" />
        </span>
      )}
      <span className="housing-tour-tray-info">
        <span className="housing-tour-tray-title">{title}</span>
        <span className="housing-tour-tray-addr">{addr}</span>
      </span>
      {isEphemeralListingId(listing.id) && (
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
