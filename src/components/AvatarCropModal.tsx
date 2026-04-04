import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { X, Check } from 'lucide-react';
import clsx from 'clsx';
import { cropAndResize, validateAvatarFile } from '../utils/avatarUpload';

interface AvatarCropModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (blob: Blob) => void;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
    isOpen, onClose, onComplete,
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

    const handleConfirm = async () => {
        if (!imageSrc || !croppedArea) return;
        const blob = await cropAndResize(imageSrc, croppedArea);
        URL.revokeObjectURL(imageSrc);
        onComplete(blob);
        handleReset();
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

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={handleReset}
            />
            <div className={clsx(
                "relative w-[380px] max-w-[90vw] rounded-2xl glass-tier3 overflow-hidden",
                "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]"
            )}>
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                    <h2 className="text-app-xl font-bold text-app-text">
                        {t('avatar.crop_title')}
                    </h2>
                    <button
                        onClick={handleReset}
                        className="p-1.5 rounded-lg text-app-text border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90"
                    >
                        <X size={16} />
                    </button>
                </div>

                {!imageSrc ? (
                    /* ファイル選択 */
                    <div className="px-6 pb-6">
                        <label className={clsx(
                            "flex flex-col items-center justify-center gap-2 py-10 rounded-xl border-2 border-dashed cursor-pointer",
                            "border-app-border hover:border-app-text/30 transition-colors"
                        )}>
                            <span className="text-app-md text-app-text-muted">
                                {t('avatar.select_image')}
                            </span>
                            <span className="text-app-base text-app-text-muted/50">
                                {t('avatar.max_size')}
                            </span>
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </label>
                        {error && (
                            <p className="mt-2 text-app-base text-red-400">{error}</p>
                        )}
                    </div>
                ) : (
                    /* クロップ画面 */
                    <>
                        <div className="relative w-full aspect-square bg-black">
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
                        {/* ズームスライダー */}
                        <div className="px-6 py-3">
                            <input
                                type="range"
                                min={1} max={3} step={0.01}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-full accent-app-text"
                            />
                        </div>
                        {/* 確定ボタン */}
                        <div className="px-6 pb-5">
                            <button
                                onClick={handleConfirm}
                                className={clsx(
                                    "w-full py-2.5 rounded-xl text-app-lg font-bold flex items-center justify-center gap-2 cursor-pointer",
                                    "bg-app-text text-app-bg hover:opacity-90 transition-all active:scale-[0.98]"
                                )}
                            >
                                <Check size={16} />
                                {t('avatar.confirm')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};
