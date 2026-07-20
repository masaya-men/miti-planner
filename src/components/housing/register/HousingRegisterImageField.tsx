/**
 * 物件登録フォームの画像アップロードフィールド
 * (2026-05-26 新設、 2026-05-26 multi 対応、 2026-05-26 drag-and-drop 並び替え対応)。
 *
 * - file input + ファイル ドラッグ&ドロップ (アップロード用)
 * - 選択直後にクライアント側で WebP 圧縮 + 長辺 1920px リサイズ + EXIF 削除
 *   (AVIF はブラウザの canvas.toBlob 非対応のため WebP 固定、 詳細は imageCompression.ts)
 * - **最大 4 枚**まで追加可能 (Instagram / Pinterest と同様の業界標準)
 * - **drag-and-drop で並び替え可能**。 1 枚目 (左端) が「カバー画像」 = 一覧の代表
 * - 各画像のプレビュー + サイズ表示 + 個別削除
 * - エラー: 非画像ファイル / 圧縮失敗 / 上限超過は赤メッセージ
 *
 * 親 (HousingRegisterForm) には CompressedImage[] を onChange で渡す。
 * 親は register 成功後に各画像を index 0..N-1 で upload リクエストする。
 */
import { useCallback, useState, useRef, useEffect, type ChangeEvent, type DragEvent } from 'react';
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
import { compressHousingImage, type CompressedImage } from '../../../lib/housing/imageCompression';

export interface HousingRegisterImageFieldProps {
  value: CompressedImage[];
  onChange: (value: CompressedImage[]) => void;
  /** 「SNS URL も画像も両方ある」 ケースで「画像優先」 と注意書きを出すかどうか */
  hasSnsUrl?: boolean;
  /** 最大枚数 (デフォルト 4) */
  maxImages?: number;
}

interface SortableItem {
  id: string;
  img: CompressedImage;
}

const ACCEPT_MIME = 'image/*';
/**
 * 登録時に物件画像として保存される枚数、かつピッカー自体の選択上限
 * (2026-07-20: 「12枚選んで先頭4枚だけ保存」という二段構えが実ユーザーの混乱を招いたため、
 * ピッカー自体をこの枚数までに制限する設計へ変更)。
 * サーバー側上限 (`api/housing/_uploadThumbnailHandler.ts` の `MAX_IMAGES_PER_LISTING`) と
 * 一致させる必要がある。
 */
export const SAVED_IMAGES_LIMIT = 4;
const DEFAULT_MAX_IMAGES = SAVED_IMAGES_LIMIT;

function formatBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(2)}MB`;
}

function makeId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 1 枚分のサムネタイル (sortable wrapper)。 */
function SortableImageTile({
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
        <img
          src={previewUrl}
          alt=""
          className="housing-register-image-tile-img"
          draggable={false}
        />
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

export function HousingRegisterImageField({
  value,
  onChange,
  hasSnsUrl,
  maxImages = DEFAULT_MAX_IMAGES,
}: HousingRegisterImageFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [overflowNotice, setOverflowNotice] = useState<{ selected: number; max: number } | null>(null);

  // 内部の sortable state。 親 value 由来で初期化し、 並び替え/追加/削除で内部更新 → onChange 通知。
  // 親から外部的に value をクリア (=[]) されたケースに追従するため effect で同期する。
  const [items, setItems] = useState<SortableItem[]>(() =>
    value.map((img) => ({ id: makeId(), img })),
  );
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!overflowNotice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverflowNotice(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overflowNotice]);

  // 親 value が外部から変わった (例: フォームリセット) ときに items を再構築。
  // ただし「items の img reference と value の img reference が一致」 する間は触らない
  // (= drag/add/remove による内部更新は items 側が真実)。
  useEffect(() => {
    const sameLen = items.length === value.length;
    const allMatch =
      sameLen && items.every((it, i) => it.img === value[i]);
    if (allMatch) return;
    // 外部リセット (value=[]) or 大きな差異: items を value から再生成
    setItems(value.map((img) => ({ id: makeId(), img })));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // 各 item に object URL を割り当て + ライフサイクル管理
  useEffect(() => {
    const nextMap = new Map<string, string>();
    items.forEach((it) => {
      const existing = previewUrls.get(it.id);
      if (existing) {
        nextMap.set(it.id, existing);
      } else {
        nextMap.set(it.id, URL.createObjectURL(it.img.file));
      }
    });
    // 古い URL を revoke
    previewUrls.forEach((url, id) => {
      if (!nextMap.has(id)) URL.revokeObjectURL(url);
    });
    setPreviewUrls(nextMap);
    return () => {
      // cleanup at unmount: 全て revoke
      // (この effect 内の return は cleanup なので nextMap の参照ではなく現在 state を read)
    };
    // items の identity 変化で再評価
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const canAddMore = items.length < maxImages;

  const updateItems = useCallback(
    (next: SortableItem[]) => {
      setItems(next);
      onChange(next.map((it) => it.img));
    },
    [onChange],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const remaining = maxImages - items.length;
      if (remaining <= 0) {
        setError(t('housing.register.image.error.too_many', { max: maxImages }));
        return;
      }
      const allSelected = Array.from(files);
      const list = allSelected.slice(0, remaining);
      for (const f of list) {
        if (!f.type.startsWith('image/')) {
          setError(t('housing.register.image.error.not_image'));
          return;
        }
      }
      setCompressing(true);
      try {
        const compressed = await Promise.all(list.map((f) => compressHousingImage(f)));
        const newItems = compressed.map((img) => ({ id: makeId(), img }));
        updateItems([...items, ...newItems]);
        if (allSelected.length > remaining) {
          setOverflowNotice({ selected: allSelected.length, max: maxImages });
        }
      } catch (e) {
        console.error('[HousingRegisterImageField] compress failed', e);
        setError(t('housing.register.image.error.compress_failed'));
      } finally {
        setCompressing(false);
      }
    },
    [items, maxImages, t, updateItems],
  );

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFiles(files);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) handleFiles(files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleRemove = useCallback(
    (index: number) => {
      const next = items.filter((_, i) => i !== index);
      updateItems(next);
      setError(null);
    },
    [items, updateItems],
  );

  // @dnd-kit setup
  const sensors = useSensors(
    // PointerSensor は 5px 動いてからドラッグ開始 (誤発動防止)
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    updateItems(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <div className="housing-register-image-field">
      <label className="housing-register-image-label">
        {t('housing.register.image.label', { max: maxImages })}
      </label>

      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy}>
            <ul className="housing-register-image-grid">
              {items.map((it, i) => (
                <SortableImageTile
                  key={it.id}
                  item={it}
                  index={i}
                  previewUrl={previewUrls.get(it.id) ?? ''}
                  isCover={i === 0}
                  onRemove={handleRemove}
                  coverBadgeLabel={t('housing.register.image.cover_badge')}
                  removeLabel={t('housing.register.image.remove')}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {canAddMore && (
        <div
          className={`housing-register-image-dropzone${dragOver ? ' is-drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          aria-label={t('housing.register.image.select_aria')}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_MIME}
            multiple
            onChange={handleInputChange}
            className="housing-register-image-input"
            tabIndex={-1}
          />
          {compressing ? (
            <span className="housing-register-image-status">
              {t('housing.register.image.compressing')}
            </span>
          ) : (
            <>
              <span className="housing-register-image-cta">
                {items.length === 0
                  ? t('housing.register.image.cta')
                  : t('housing.register.image.cta_add')}
              </span>
              <span className="housing-register-image-hint">
                {t('housing.register.image.hint', {
                  current: items.length,
                  max: maxImages,
                })}
              </span>
            </>
          )}
        </div>
      )}

      {items.length > 1 && (
        <p className="housing-register-image-note">
          {t('housing.register.image.reorder_hint')}
        </p>
      )}

      {error && (
        <p className="housing-register-image-error" role="alert">
          {error}
        </p>
      )}

      {hasSnsUrl && items.length > 0 && (
        <p className="housing-register-image-note">
          {t('housing.register.image.sns_override_note')}
        </p>
      )}

      {overflowNotice && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'var(--housing-detail-backdrop-bg)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOverflowNotice(null);
          }}
        >
          <div
            className="max-w-sm w-full"
            style={{
              background: 'var(--housing-panel-bg)',
              border: '1px solid var(--housing-panel-border)',
              borderRadius: 'var(--housing-panel-radius)',
              color: 'var(--housing-text)',
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 'var(--housing-text-lg)', fontWeight: 600, marginBottom: 12 }}>
              {t('housing.register.image.limitModal.title', { max: overflowNotice.max })}
            </h2>
            <p
              className="housing-register-image-limit-modal-body"
              style={{ fontSize: 'var(--housing-text-base)', color: 'var(--housing-text-dim)', marginBottom: 20 }}
            >
              {t('housing.register.image.limitModal.body', {
                selected: overflowNotice.selected,
                max: overflowNotice.max,
              })}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setOverflowNotice(null)}
                className="housing-action-btn housing-btn-primary"
                style={{ padding: '8px 16px' }}
              >
                {t('housing.register.image.limitModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
