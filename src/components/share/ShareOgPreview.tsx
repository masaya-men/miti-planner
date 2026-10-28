import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

interface ShareOgPreviewProps {
    /** ログイン中のみロゴのドラッグ&ドロップを受け付ける */
    canDropLogo: boolean;
    ogImageUrl: string | null;
    imageLoaded: boolean;
    setImageLoaded: (loaded: boolean) => void;
    showLogo: boolean;
    updateShareLogo: (withLogo: boolean) => Promise<void>;
    processLogoFile: (file: File) => void;
}

/** OGPプレビュー（ロゴD&D対応） */
export const ShareOgPreview: React.FC<ShareOgPreviewProps> = ({
    canDropLogo, ogImageUrl, imageLoaded, setImageLoaded, showLogo, updateShareLogo, processLogoFile,
}) => {
    const { t } = useTranslation();
    const [dragging, setDragging] = useState(false);
    const dragCountRef = useRef(0);

    return (
        <div className="px-5 py-4">
            <div
                className={clsx(
                    "relative w-full aspect-[1200/630] bg-app-surface2/60 rounded-lg overflow-hidden border transition-colors",
                    canDropLogo && dragging
                        ? "border-app-text border-dashed"
                        : "border-app-border"
                )}
                onDragEnter={canDropLogo ? (e) => {
                    e.preventDefault();
                    dragCountRef.current++;
                    setDragging(true);
                } : undefined}
                onDragOver={canDropLogo ? (e) => { e.preventDefault(); } : undefined}
                onDragLeave={canDropLogo ? () => {
                    dragCountRef.current--;
                    if (dragCountRef.current <= 0) {
                        dragCountRef.current = 0;
                        setDragging(false);
                    }
                } : undefined}
                onDrop={canDropLogo ? (e) => {
                    e.preventDefault();
                    dragCountRef.current = 0;
                    setDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) processLogoFile(file);
                } : undefined}
            >
                {/* D&Dオーバーレイ（ログインユーザーのみ） */}
                {canDropLogo && dragging && (
                    <div className="absolute inset-0 flex items-center justify-center bg-app-bg/60 z-20 pointer-events-none">
                        <span className="text-app-lg font-bold text-app-text">
                            {t('team_logo.upload')}
                        </span>
                    </div>
                )}
                {/* 生成中インジケータ */}
                {(!imageLoaded) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                        <Loader2 size={24} className="animate-spin text-app-text-muted" />
                        <span className="text-app-md text-app-text-muted font-medium">
                            {t('app.generating_preview')}
                        </span>
                    </div>
                )}
                {ogImageUrl && (
                    // key に URL を渡すことで、ogImageUrl が変わるたびに <img> を
                    // 完全に再マウントする。これにより古い img のロード状態が引き継がれず、
                    // 新 src で確実に新規 fetch + onLoad/onError が発火する。
                    // （src だけ書き換わっても新規ロードがトリガーされず「永遠に生成中」に
                    //  なる事象への対策）
                    <img
                        key={ogImageUrl}
                        src={ogImageUrl}
                        alt="OGP Preview"
                        className={clsx("w-full h-full object-contain transition-opacity duration-300", imageLoaded ? "opacity-100" : "opacity-0")}
                        onLoad={() => setImageLoaded(true)}
                        onError={() => setImageLoaded(true)}
                    />
                )}
                {/* プレビュー更新ボタン（トグルOFF→ONと同じ処理で確実に再生成） */}
                {imageLoaded && ogImageUrl && (
                    <button
                        onClick={async () => {
                            await updateShareLogo(false);
                            await updateShareLogo(showLogo);
                        }}
                        className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all cursor-pointer"
                        title={t('app.share_refresh_preview')}
                    >
                        <RefreshCw size={13} />
                    </button>
                )}
            </div>
        </div>
    );
};
