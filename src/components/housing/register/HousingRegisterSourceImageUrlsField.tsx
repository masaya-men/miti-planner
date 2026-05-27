/**
 * 物件登録フォームの「外部 URL 画像」 並び替えフィールド (2026-05-27 新設)。
 *
 * OGP 取得経由 (housingsnap / studio-xiv / Twitter / YouTube) で取れた画像 URL リストを
 * ドラッグで並び替え + 個別削除できるようにする。 画像本体は LoPo に取り込まず、
 * 元サイトの URL を `<img src>` で直接読む (= 投稿削除で自動消失、 LoPo 帯域消費ゼロ)。
 *
 * - 最大 maxImages 枚 (デフォルト 4)
 * - 1 枚目 (左端) が「カバー画像」 = 一覧の代表
 * - dnd-kit でドラッグ並び替え
 * - `<img onError>` で読めない画像は自動で枠だけ残して非表示
 *
 * 既存 HousingRegisterImageField (アップロード経路) と並ぶ姉妹コンポーネント。
 */
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

export interface HousingRegisterSourceImageUrlsFieldProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** 最大保存枚数 (デフォルト 4)。 これを超えた分は灰色表示で「使用されない」 と知らせる */
  maxImages?: number;
}

const DEFAULT_MAX_IMAGES = 4;

interface SortableItem {
  /** dnd-kit が要求する安定 ID。 url が重複しないので url 自体を ID にする */
  id: string;
  url: string;
}

function toItems(urls: string[]): SortableItem[] {
  return urls.map((url, i) => ({ id: `${i}-${url}`, url }));
}

/** 1 枚分のサムネタイル (sortable wrapper)。 */
function SortableUrlTile({
  item,
  index,
  isCover,
  isUsed,
  onRemove,
  coverBadgeLabel,
  usedBadgeLabel,
  removeLabel,
}: {
  item: SortableItem;
  index: number;
  isCover: boolean;
  /** 登録時に物件画像として使われる枚 (= 先頭 maxImages 枚) かどうか */
  isUsed: boolean;
  onRemove: (index: number) => void;
  coverBadgeLabel: string;
  usedBadgeLabel: string;
  removeLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const [imgFailed, setImgFailed] = useState(false);
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
      data-used={isUsed}
      data-failed={imgFailed}
      {...attributes}
      {...listeners}
    >
      <img
        src={item.url}
        alt=""
        className="housing-register-image-tile-img"
        draggable={false}
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
      {isCover ? (
        <span className="housing-register-image-tile-badge">{coverBadgeLabel}</span>
      ) : isUsed ? (
        <span className="housing-register-image-tile-badge" data-variant="used">
          {usedBadgeLabel}
        </span>
      ) : null}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="housing-register-image-tile-remove"
        aria-label={removeLabel}
      >
        ✕
      </button>
    </li>
  );
}

export function HousingRegisterSourceImageUrlsField({
  value,
  onChange,
  maxImages = DEFAULT_MAX_IMAGES,
}: HousingRegisterSourceImageUrlsFieldProps) {
  const { t } = useTranslation();
  const items = toItems(value);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const oldIndex = items.findIndex((it) => it.id === active.id);
      const newIndex = items.findIndex((it) => it.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      onChange(arrayMove(value, oldIndex, newIndex));
    },
    [items, value, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  if (value.length === 0) return null;

  return (
    <div className="housing-register-image-field">
      <label className="housing-register-image-label">
        {t('housing.register.sourceImages.label', { max: maxImages })}
      </label>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy}>
          <ul className="housing-register-image-grid">
            {items.map((it, i) => (
              <SortableUrlTile
                key={it.id}
                item={it}
                index={i}
                isCover={i === 0}
                isUsed={i < maxImages}
                onRemove={handleRemove}
                coverBadgeLabel={t('housing.register.image.cover_badge')}
                usedBadgeLabel={t('housing.register.image.used_badge')}
                removeLabel={t('housing.register.image.remove')}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {value.length > 1 && (
        <p className="housing-register-image-note">
          {t('housing.register.sourceImages.reorder_hint', { max: maxImages })}
        </p>
      )}
    </div>
  );
}
