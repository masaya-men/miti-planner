import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { HousingPanelModal } from '../HousingPanelModal';
import { cropAndResize, validateAvatarFile } from '../../../utils/avatarUpload';

interface HousingAvatarCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (blob: Blob) => void;
}

/**
 * ハウジング用アイコン変更モーダル。ロジックは共通の AvatarCropModal.tsx (LoPo 既存 UI 版) と
 * 同じだが、見た目は HousingPanelModal + housing.css トークンでハウジングトンマナに統一する
 * (旧: LoPo 版をそのまま流用しており白黒トーンが浮いていた・2026-07-24 実機指摘)。
 */
export const HousingAvatarCropModal: React.FC<HousingAvatarCropModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { t } = useTranslation();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setError(t(validationError));
      return;
    }

    setError(null);
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleReset = () => {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedArea) return;
    const blob = await cropAndResize(imageSrc, croppedArea);
    URL.revokeObjectURL(imageSrc);
    onComplete(blob);
    // onComplete 後は親が isOpen を false にする想定だが、state は明示的に畳んでおく
    // (次回オープン時に前回のプレビューが一瞬見えるのを防ぐ)。
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setError(null);
  };

  return (
    <HousingPanelModal
      open={isOpen}
      onClose={handleReset}
      title={t('avatar.crop_title')}
      closeLabel={t('housing.account.closeLabel')}
      maxWidth={380}
      maxHeightRatio={0.86}
      modalRole="account"
    >
      <div className="housing-avatar-crop">
        {!imageSrc ? (
          <label className="housing-avatar-crop-dropzone">
            <span className="housing-avatar-crop-dropzone-label">{t('avatar.select_image')}</span>
            <span className="housing-avatar-crop-dropzone-hint">{t('avatar.max_size')}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="housing-avatar-crop-input"
              onChange={handleFileSelect}
            />
          </label>
        ) : (
          <>
            <div className="housing-avatar-crop-stage">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="housing-avatar-crop-zoom"
            />
            <button type="button" className="housing-avatar-crop-confirm" onClick={handleConfirm}>
              <Check size={16} aria-hidden="true" />
              {t('avatar.confirm')}
            </button>
          </>
        )}
        {error && <p className="housing-field-error">{error}</p>}
      </div>
    </HousingPanelModal>
  );
};
