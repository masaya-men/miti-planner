/**
 * 物件登録フォームの画像アップロードフィールド (2026-05-26 新設、 imageMode='thumbnail' 経路)。
 *
 * - file input + ドラッグ&ドロップ
 * - 選択直後にクライアント側で AVIF 圧縮 + 長辺 1920px リサイズ + EXIF 削除
 * - プレビュー表示 + 圧縮後サイズ表示
 * - エラー: 非画像ファイル / 圧縮失敗 / サイズ過大 (1MB 超) は赤メッセージ
 *
 * 親 (HousingRegisterForm) には CompressedImage オブジェクトを onChange で渡す。
 * 親はそれを fieldState に持ち、 register 成功後の upload リクエストで送信する。
 */
import { useCallback, useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { compressHousingImage, type CompressedImage } from '../../../lib/housing/imageCompression';

export interface HousingRegisterImageFieldProps {
  value: CompressedImage | null;
  onChange: (value: CompressedImage | null) => void;
  /** 「SNS URL も画像も両方ある」 ケースで「画像優先」 と注意書きを出すかどうか */
  hasSnsUrl?: boolean;
}

const ACCEPT_MIME = 'image/*';

export function HousingRegisterImageField({
  value,
  onChange,
  hasSnsUrl,
}: HousingRegisterImageFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith('image/')) {
        setError(t('housing.register.image.error.not_image'));
        return;
      }
      setCompressing(true);
      try {
        const compressed = await compressHousingImage(file);
        // プレビュー用 object URL (圧縮済 File)
        const url = URL.createObjectURL(compressed.file);
        // 古い URL を revoke (メモリリーク防止)
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(url);
        onChange(compressed);
      } catch (e) {
        console.error('[HousingRegisterImageField] compress failed', e);
        setError(t('housing.register.image.error.compress_failed'));
      } finally {
        setCompressing(false);
      }
    },
    [onChange, previewUrl, t],
  );

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // 同じファイルを連続選択しても onChange が走るように reset
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleRemove = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onChange(null);
    setError(null);
  };

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b}B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
    return `${(b / (1024 * 1024)).toFixed(2)}MB`;
  };

  return (
    <div className="housing-register-image-field">
      <label className="housing-register-image-label">
        {t('housing.register.image.label')}
      </label>

      {!value ? (
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
                {t('housing.register.image.cta')}
              </span>
              <span className="housing-register-image-hint">
                {t('housing.register.image.hint')}
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="housing-register-image-preview">
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              className="housing-register-image-preview-img"
            />
          )}
          <div className="housing-register-image-preview-meta">
            <span>
              {t('housing.register.image.compressed_label')}
              {': '}
              {formatBytes(value.originalBytes)} → {formatBytes(value.compressedBytes)}
              {' '}
              ({value.mimeType.replace('image/', '').toUpperCase()})
            </span>
            <button
              type="button"
              onClick={handleRemove}
              className="housing-register-image-remove"
            >
              {t('housing.register.image.remove')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="housing-register-image-error" role="alert">
          {error}
        </p>
      )}

      {hasSnsUrl && value && (
        <p className="housing-register-image-note">
          {t('housing.register.image.sns_override_note')}
        </p>
      )}
    </div>
  );
}
