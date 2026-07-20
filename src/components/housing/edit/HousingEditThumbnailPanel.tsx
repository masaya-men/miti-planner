import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingEditImageGrid } from './HousingEditImageGrid';
import { compressHousingImage } from '../../../lib/housing/imageCompression';
import {
  uploadListingThumbnail,
  deleteListingThumbnail,
  reorderListingThumbnails,
} from '../../../lib/housingApiClient';
import { showToast } from '../../Toast';
import { SAVED_IMAGES_LIMIT } from '../register/HousingRegisterImageField';

export interface HousingEditThumbnailPanelProps {
  listingId: string;
  images: string[];
  onImagesChange: (next: string[]) => void;
}

/**
 * 編集ページの直接アップロード側パネル (Plan B・2026-07-21)。
 * 「差し替え」専用UIは持たない。既存画像は HousingEditImageGrid の削除+ドラッグのみで、
 * 入れ替えたい場合は「削除してから追加」で対応する (設計書で確定済み)。
 * 追加は1ファイルずつ (create モードの複数選択とは異なり、都度サーバーへ即時反映するため
 * バッチ処理の複雑化を避ける意図的なスコープ縮小)。
 */
export function HousingEditThumbnailPanel({ listingId, images, onImagesChange }: HousingEditThumbnailPanelProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const canAddMore = images.length < SAVED_IMAGES_LIMIT;

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        showToast(t('housing.register.image.error.not_image'), 'error');
        return;
      }
      setUploading(true);
      try {
        const compressed = await compressHousingImage(file);
        const result = await uploadListingThumbnail({
          listingId,
          base64: compressed.base64,
          mimeType: compressed.mimeType,
          index: images.length,
        });
        // thumbnailPaths は型上 optional (サーバーは常に返すが後方互換のため)。
        // 万一欠けていた場合は thumbnailPath (今回追加した1枚) を末尾に追記してフォールバックする。
        onImagesChange(result.thumbnailPaths ?? [...images, result.thumbnailPath]);
      } catch {
        showToast(t('housing.register.editMedia.save_failed'), 'error');
      } finally {
        setUploading(false);
      }
    },
    [listingId, images.length, onImagesChange, t],
  );

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDelete = useCallback(
    (index: number) => deleteListingThumbnail({ listingId, index }).then((r) => r.thumbnailPaths),
    [listingId],
  );
  const handleReorder = useCallback(
    (newOrder: string[]) => reorderListingThumbnails({ listingId, newOrder }).then((r) => r.thumbnailPaths),
    [listingId],
  );

  return (
    <div className="housing-register-image-field">
      <label className="housing-register-image-label">
        {t('housing.register.image.label', { max: SAVED_IMAGES_LIMIT })}
      </label>
      <HousingEditImageGrid
        images={images}
        onImagesChange={onImagesChange}
        onDelete={handleDelete}
        onReorder={handleReorder}
        minImages={1}
      />
      {canAddMore && (
        <div
          className="housing-register-image-dropzone"
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
            accept="image/*"
            onChange={handleInputChange}
            className="housing-register-image-input"
            tabIndex={-1}
          />
          {uploading ? (
            <span className="housing-register-image-status">{t('housing.register.image.compressing')}</span>
          ) : (
            <>
              <span className="housing-register-image-cta">
                {images.length === 0 ? t('housing.register.image.cta') : t('housing.register.image.cta_add')}
              </span>
              <span className="housing-register-image-hint">
                {t('housing.register.image.hint', { current: images.length, max: SAVED_IMAGES_LIMIT })}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
