import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check, Loader2, ExternalLink, Upload, ImageIcon, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { uploadTeamLogo, deleteTeamLogo, validateLogoFile } from '../utils/logoUpload';
import { showToast } from './Toast';
import { apiFetch } from '../lib/apiClient';
import type { SavedPlan } from '../types';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    contentLabel: string | null;
    currentPlan: SavedPlan | undefined;
    /** バンドル共有用：複数プランのデータ */
    bundlePlans?: { contentId: string | null; title: string; planData: any }[];
}

export const ShareModal: React.FC<ShareModalProps> = ({
    isOpen, onClose, contentLabel, currentPlan, bundlePlans,
}) => {
    const { t } = useTranslation();
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);
    const [, setLoading] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showPlanTitle, setShowPlanTitle] = useState(true);
    const [shareIdRef, setShareIdRef] = useState<string | null>(null);

    // チームロゴ関連
    const { user, teamLogoUrl, setTeamLogoUrl } = useAuthStore();
    const [showLogo, setShowLogo] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const isBundle = bundlePlans && bundlePlans.length > 0;

    /**
     * OGP画像URLを構築するヘルパー
     * プラン名・ロゴの表示フラグをクエリパラメータに反映する
     */
    const buildOgUrl = (id: string, planTitle: boolean, logo: boolean) => {
        let url = `${window.location.origin}/api/og?id=${id}`;
        if (!planTitle) url += '&showTitle=false';
        if (logo && teamLogoUrl) url += `&logoUrl=${encodeURIComponent(teamLogoUrl)}`;
        return url;
    };

    // モーダルが開いたら共有URLを生成
    useEffect(() => {
        if (!isOpen) return;
        setShareUrl(null);
        setOgImageUrl(null);
        setImageLoaded(false);
        setCopied(false);
        generateShareUrl();
    }, [isOpen]);

    const generateShareUrl = async () => {
        setLoading(true);
        try {
            let body: any;
            if (isBundle) {
                body = { plans: bundlePlans };
            } else {
                const snapshot = useMitigationStore.getState().getSnapshot();
                body = {
                    planData: snapshot,
                    title: currentPlan?.title || '',
                    contentId: currentPlan?.contentId || null,
                };
            }

            const res = await apiFetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { shareId } = await res.json();
            setShareIdRef(shareId);
            const url = `${window.location.origin}/share/${shareId}`;
            setShareUrl(url);
            setOgImageUrl(buildOgUrl(shareId, showPlanTitle, showLogo));
        } catch (err) {
            console.error('Share failed:', err);
            showToast(t('app.share_failed') || '共有リンクの生成に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    // プラン名表示トグル変更時にOGP画像を再生成
    const handleTogglePlanTitle = () => {
        const next = !showPlanTitle;
        setShowPlanTitle(next);
        if (shareIdRef) {
            setImageLoaded(false);
            setOgImageUrl(buildOgUrl(shareIdRef, next, showLogo));
        }
    };

    // ロゴ表示トグル変更時にOGP画像を再生成
    const handleToggleLogo = () => {
        const next = !showLogo;
        setShowLogo(next);
        if (shareIdRef) {
            setImageLoaded(false);
            setOgImageUrl(buildOgUrl(shareIdRef, showPlanTitle, next));
        }
    };

    // ロゴファイル処理（共通）
    const processLogoFile = async (file: File) => {
        if (!user) return;

        const error = validateLogoFile(file);
        if (error) {
            showToast(t(`team_logo.${error}`), 'error');
            return;
        }

        setUploading(true);
        try {
            const url = await uploadTeamLogo(user.uid, file);
            setTeamLogoUrl(url);
            showToast(t('team_logo.upload_success'));
            if (shareIdRef) {
                setImageLoaded(false);
                setOgImageUrl(buildOgUrl(shareIdRef, showPlanTitle, true));
                setShowLogo(true);
            }
        } catch (err) {
            console.error('[LogoUpload] アップロードエラー詳細:', err);
            showToast(t('team_logo.error_upload_failed'), 'error');
        } finally {
            setUploading(false);
        }
    };

    // ファイル選択からのアップロード
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processLogoFile(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ドラッグ＆ドロップ（PC向け）
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) await processLogoFile(file);
    };

    // ロゴ削除処理
    const handleLogoDelete = async () => {
        if (!user) return;
        try {
            await deleteTeamLogo(user.uid);
            setTeamLogoUrl(null);
            setShowLogo(false);
            showToast(t('team_logo.remove_success'));
            // OGPプレビューをロゴなし状態で更新
            if (shareIdRef) {
                setImageLoaded(false);
                setOgImageUrl(buildOgUrl(shareIdRef, showPlanTitle, false));
            }
        } catch {
            showToast(t('team_logo.error_remove_failed'), 'error');
        }
    };

    const handleCopy = async () => {
        if (!shareUrl) return;
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        showToast(t('app.link_copied'));
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShareX = () => {
        if (!shareUrl) return;
        const text = `${contentLabel || 'LoPo'} - ${t('app.title')}`;
        window.open(
            `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
            '_blank',
            'noopener,noreferrer'
        );
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
        >
            <div
                className="relative glass-tier3 rounded-2xl shadow-2xl w-[420px] max-w-[90vw] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-app-border">
                    <h3 className="text-sm font-bold text-app-text">
                        {isBundle
                            ? t('app.share_bundle_title')
                            : t('app.share_modal_title')
                        }
                    </h3>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-app-text-muted hover:bg-app-text/10 transition-colors cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* OGPプレビュー（ロゴD&D対応） */}
                <div className="px-5 py-4">
                    <div
                        className={clsx(
                            "relative w-full aspect-[1200/630] bg-app-surface2 rounded-lg overflow-hidden border transition-colors",
                            user && dragging
                                ? "border-app-text border-dashed"
                                : "border-app-border"
                        )}
                        onDragOver={user ? (e) => { e.preventDefault(); setDragging(true); } : undefined}
                        onDragLeave={user ? () => setDragging(false) : undefined}
                        onDrop={user ? handleDrop : undefined}
                    >
                        {/* D&Dオーバーレイ（ログインユーザーのみ） */}
                        {user && dragging && (
                            <div className="absolute inset-0 flex items-center justify-center bg-app-bg/60 z-20">
                                <span className="text-xs font-bold text-app-text">
                                    {t('team_logo.upload')}
                                </span>
                            </div>
                        )}
                        {/* 生成中インジケータ: API通信中 or 画像ロード完了前まで表示 */}
                        {(!imageLoaded) && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                                <Loader2 size={24} className="animate-spin text-app-text-muted" />
                                <span className="text-[11px] text-app-text-muted font-medium">
                                    {t('app.generating_preview')}
                                </span>
                            </div>
                        )}
                        {ogImageUrl && (
                            <img
                                src={ogImageUrl}
                                alt="OGP Preview"
                                className={clsx("w-full h-full object-cover transition-opacity duration-300", imageLoaded ? "opacity-100" : "opacity-0")}
                                onLoad={() => setImageLoaded(true)}
                            />
                        )}
                    </div>
                </div>

                {/* プラン名表示トグル（バンドルでない場合のみ） */}
                {!isBundle && (
                    <div className="px-5 pb-2">
                        <button
                            onClick={handleTogglePlanTitle}
                            className="flex items-center gap-2.5 w-full py-1.5 text-left group cursor-pointer"
                        >
                            <div className={clsx(
                                "w-8 h-[18px] rounded-full transition-colors duration-200 relative shrink-0",
                                showPlanTitle ? "bg-app-text" : "bg-app-surface2 border border-app-border"
                            )}>
                                <div className={clsx(
                                    "absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200",
                                    showPlanTitle ? "left-[15px] bg-app-bg" : "left-[2px] bg-app-text-muted"
                                )} />
                            </div>
                            <span className="text-xs text-app-text-muted group-hover:text-app-text transition-colors">
                                {t('app.include_plan_title')}
                            </span>
                        </button>
                    </div>
                )}

                {/* チームロゴ設定（ログインユーザーのみ） */}
                {user && (
                    <div className="px-5 pb-2 space-y-2">
                        {/* ロゴ表示トグル（ロゴがある場合のみ） */}
                        {teamLogoUrl && (
                            <button
                                onClick={handleToggleLogo}
                                className="flex items-center gap-2.5 w-full py-1.5 text-left group cursor-pointer"
                            >
                                <div className={clsx(
                                    "w-8 h-[18px] rounded-full transition-colors duration-200 relative shrink-0",
                                    showLogo ? "bg-app-text" : "bg-app-surface2 border border-app-border"
                                )}>
                                    <div className={clsx(
                                        "absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200",
                                        showLogo ? "left-[15px] bg-app-bg" : "left-[2px] bg-app-text-muted"
                                    )} />
                                </div>
                                <span className="text-xs text-app-text-muted group-hover:text-app-text transition-colors">
                                    {t('team_logo.show_on_ogp')}
                                </span>
                            </button>
                        )}

                        {/* ロゴ設定行（コンパクト） */}
                        <div className="flex items-center gap-2">
                            {teamLogoUrl ? (
                                <>
                                    <img
                                        src={teamLogoUrl}
                                        alt="Team Logo"
                                        className="w-8 h-8 rounded object-cover border border-app-border"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer border border-app-border"
                                    >
                                        <ImageIcon size={11} />
                                        {t('team_logo.change')}
                                    </button>
                                    <button
                                        onClick={handleLogoDelete}
                                        disabled={uploading}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer border border-app-border"
                                    >
                                        <Trash2 size={11} />
                                        {t('team_logo.remove')}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => !uploading && fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold border border-app-border text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer"
                                >
                                    {uploading ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                        <Upload size={12} />
                                    )}
                                    {uploading ? t('team_logo.uploading') : t('team_logo.upload')}
                                </button>
                            )}
                            <span className="text-[10px] text-app-text-muted/50 ml-auto">
                                {t('team_logo.format_hint')}
                            </span>
                        </div>

                        {/* 隠しファイルインプット */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleLogoUpload}
                            className="hidden"
                        />
                    </div>
                )}

                {/* アクションボタン */}
                <div className="px-5 pb-5 flex flex-col gap-2">
                    {/* URLコピー */}
                    <button
                        onClick={handleCopy}
                        disabled={!shareUrl}
                        className={clsx(
                            "flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer",
                            shareUrl
                                ? "bg-app-text text-app-bg hover:opacity-80 active:scale-[0.98]"
                                : "bg-app-surface2 text-app-text-muted cursor-not-allowed"
                        )}
                    >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied
                            ? t('app.link_copied')
                            : t('app.copy_share_url')
                        }
                    </button>

                    {/* X共有 */}
                    <button
                        onClick={handleShareX}
                        disabled={!shareUrl}
                        className={clsx(
                            "flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer border",
                            shareUrl
                                ? "border-app-border text-app-text hover:bg-app-text/10 active:scale-[0.98]"
                                : "border-app-border text-app-text-muted cursor-not-allowed"
                        )}
                    >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        {t('app.share_on_x')}
                        <ExternalLink size={12} className="text-app-text-muted" />
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
