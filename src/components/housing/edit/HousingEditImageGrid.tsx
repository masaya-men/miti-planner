import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { showToast } from '../../Toast';

export interface HousingEditImageGridProps {
  images: string[];
  onImagesChange: (next: string[]) => void;
  onDelete: (index: number) => Promise<string[]>;
  onReorder: (newOrder: string[]) => Promise<string[]>;
  /** これ以下の枚数では削除ボタンを disabled にする (既定 1 = 最後の1枚は消せない)。 */
  minImages?: number;
}

interface SortableItem {
  id: string;
  url: string;
}

function toItems(urls: string[]): SortableItem[] {
  return urls.map((url, i) => ({ id: `${i}-${url}`, url }));
}

function SortableEditTile({
  item,
  index,
  isCover,
  isPending,
  removeDisabled,
  dragDisabled,
  onRemove,
  coverBadgeLabel,
  removeLabel,
}: {
  item: SortableItem;
  index: number;
  isCover: boolean;
  isPending: boolean;
  removeDisabled: boolean;
  dragDisabled: boolean;
  onRemove: (index: number) => void;
  coverBadgeLabel: string;
  removeLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: dragDisabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: dragDisabled ? 'default' : isDragging ? 'grabbing' : 'grab',
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="housing-register-image-tile"
      data-dragging={isDragging}
      data-pending={isPending}
      {...attributes}
      {...listeners}
    >
      <img src={item.url} alt="" className="housing-register-image-tile-img" draggable={false} loading="lazy" />
      {isCover && <span className="housing-register-image-tile-badge">{coverBadgeLabel}</span>}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="housing-register-image-tile-remove"
        aria-label={removeLabel}
        disabled={removeDisabled}
      >
        ✕
      </button>
    </li>
  );
}

/**
 * 編集ページ専用: 画像URL配列の削除/並び替えを、操作のたびにサーバーへ即時反映する
 * 共有グリッド (Plan B・2026-07-21)。直接アップロード側 (thumbnailPaths) と
 * URL経由側 (sourceImageUrls) の両方から、対応する API 呼び出しを注入して使い回す。
 *
 * 確認ダイアログは出さない (ユーザー判断・設計書参照)。保存中は対象タイルを
 * disabled+減光し、サーバー応答後に確定表示する (B案)。並び替えはドロップ時点で
 * 見た目を確定させ (通常のドラッグ操作と同じ)、失敗時のみ元の順序へロールバックする。
 */
export function HousingEditImageGrid({
  images,
  onImagesChange,
  onDelete,
  onReorder,
  minImages = 1,
}: HousingEditImageGridProps) {
  const { t } = useTranslation();
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const items = toItems(images);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleRemove = useCallback(
    async (index: number) => {
      if (busy) return;
      setPendingIndex(index);
      setBusy(true);
      try {
        const next = await onDelete(index);
        onImagesChange(next);
      } catch {
        showToast(t('housing.register.editMedia.save_failed'), 'error');
      } finally {
        setPendingIndex(null);
        setBusy(false);
      }
    },
    [busy, onDelete, onImagesChange, t],
  );

  const handleDragEnd = useCallback(
    async (e: DragEndEvent) => {
      if (busy) return;
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const oldIndex = items.findIndex((it) => it.id === active.id);
      const newIndex = items.findIndex((it) => it.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const previous = images;
      const next = arrayMove(images, oldIndex, newIndex);
      onImagesChange(next);
      setBusy(true);
      try {
        const confirmed = await onReorder(next);
        onImagesChange(confirmed);
      } catch {
        onImagesChange(previous);
        showToast(t('housing.register.editMedia.save_failed'), 'error');
      } finally {
        setBusy(false);
      }
    },
    [busy, items, images, onReorder, onImagesChange, t],
  );

  if (images.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy}>
        <ul className="housing-register-image-grid">
          {items.map((it, i) => (
            <SortableEditTile
              key={it.id}
              item={it}
              index={i}
              isCover={i === 0}
              isPending={pendingIndex === i}
              removeDisabled={busy || images.length <= minImages}
              dragDisabled={busy}
              onRemove={handleRemove}
              coverBadgeLabel={t('housing.register.image.cover_badge')}
              removeLabel={t('housing.register.image.remove')}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
