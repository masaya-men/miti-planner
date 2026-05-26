/**
 * 物件登録フォームの画像アップロードフィールド (2026-05-26 新設、 2026-05-26 multi 対応)。
 *
 * - file input + ドラッグ&ドロップ
 * - 選択直後にクライアント側で AVIF 圧縮 + 長辺 1920px リサイズ + EXIF 削除
 * - **最大 4 枚**まで追加可能 (Instagram / Pinterest と同様の業界標準)
 * - 各画像のプレビュー + サイズ表示 + 個別削除
 * - 1 枚目が一覧の代表画像になる (順序は追加順、 並び替えは β 以降)
 * - エラー: 非画像ファイル / 圧縮失敗 / 上限超過は赤メッセージ
 *
 * 親 (HousingRegisterForm) には CompressedImage[] を onChange で渡す。
 * 親は register 成功後に各画像を index 0..N-1 で upload リクエストする。
 */
import { useCallback, useState, useRef, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { compressHousingImage, type CompressedImage } from '../../../lib/housing/imageCompression';

export interface HousingRegisterImageFieldProps {
  value: CompressedImage[];
  onChange: (value: CompressedImage[]) => void;
  /** 「SNS URL も画像も両方ある」 ケースで「画像優先」 と注意書きを出すかどうか */
  hasSnsUrl?: boolean;
  /** 最大枚数 (デフォルト 4) */
  maxImages?: number;
}

const ACCEPT_MIME = 'image/*';
const DEFAULT_MAX_IMAGES = 4;

function formatBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(2)}MB`;
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
  // 各 CompressedImage に紐づく object URL。 unmount / 入れ替え時に revoke する。
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // value (CompressedImage[]) が変わったら previewUrls を再生成。
  // 既存 URL は revoke してメモリリークを防ぐ。
  useEffect(() => {
    const next = value.map((v) => URL.createObjectURL(v.file));
    setPreviewUrls((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return next;
    });
    return () => {
      next.forEach((url) => URL.revokeObjectURL(url));
    };
    // value identity に依存。 onChange で配列再生成しているので OK。
  }, [value]);

  const canAddMore = value.length < maxImages;

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const remaining = maxImages - value.length;
      if (remaining <= 0) {
        setError(t('housing.register.image.error.too_many', { max: maxImages }));
        return;
      }
      const list = Array.from(files).slice(0, remaining);
      // 非画像が混ざっていたらエラー (バッチ全体を弾く)
      for (const f of list) {
        if (!f.type.startsWith('image/')) {
          setError(t('housing.register.image.error.not_image'));
          return;
        }
      }
      setCompressing(true);
      try {
        const compressed = await Promise.all(list.map((f) => compressHousingImage(f)));
        onChange([...value, ...compressed]);
      } catch (e) {
        console.error('[HousingRegisterImageField] compress failed', e);
        setError(t('housing.register.image.error.compress_failed'));
      } finally {
        setCompressing(false);
      }
    },
    [maxImages, onChange, t, value],
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

  const handleRemove = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    setError(null);
  };

  return (
    <div className="housing-register-image-field">
      <label className="housing-register-image-label">
        {t('housing.register.image.label', { max: maxImages })}
      </label>

      {value.length > 0 && (
        <ul className="housing-register-image-grid">
          {value.map((img, i) => (
            <li key={i} className="housing-register-image-tile">
              {previewUrls[i] && (
                <img
                  src={previewUrls[i]}
                  alt=""
                  className="housing-register-image-tile-img"
                />
              )}
              {i === 0 && (
                <span className="housing-register-image-tile-badge">
                  {t('housing.register.image.cover_badge')}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="housing-register-image-tile-remove"
                aria-label={t('housing.register.image.remove')}
              >
                ✕
              </button>
              <span className="housing-register-image-tile-meta">
                {formatBytes(img.compressedBytes)} ({img.mimeType.replace('image/', '').toUpperCase()})
              </span>
            </li>
          ))}
        </ul>
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
                {value.length === 0
                  ? t('housing.register.image.cta')
                  : t('housing.register.image.cta_add')}
              </span>
              <span className="housing-register-image-hint">
                {t('housing.register.image.hint', {
                  current: value.length,
                  max: maxImages,
                })}
              </span>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="housing-register-image-error" role="alert">
          {error}
        </p>
      )}

      {hasSnsUrl && value.length > 0 && (
        <p className="housing-register-image-note">
          {t('housing.register.image.sns_override_note')}
        </p>
      )}
    </div>
  );
}
