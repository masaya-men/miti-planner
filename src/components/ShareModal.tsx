import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useTranslation, Trans } from 'react-i18next';
import { Link } from 'react-router-dom';
import { X, Copy, Check, Loader2, ExternalLink, Upload, Trash2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { LoginModal } from './LoginModal';
import { uploadTeamLogo, deleteTeamLogo, validateLogoFile } from '../utils/logoUpload';
import { showToast } from './Toast';
import { apiFetch } from '../lib/apiClient';
import type { SavedPlan } from '../types';
import { useTutorialStore } from '../store/useTutorialStore';

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
    useEscapeClose(isOpen, onClose);
    const { t, i18n } = useTranslation();
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
    const dragCountRef = useRef(0);
    const [showLoginModal, setShowLoginModal] = useState(false);

    const isBundle = bundlePlans && bundlePlans.length > 0;

    /**
     * OGP画像URLを構築するヘルパー
     * ロゴはshareデータに埋め込み済みなので、showLogoフラグのみ渡す
     */
    const buildOgUrl = (id: string, planTitle: boolean, logo: boolean) => {
        let url = `${window.location.origin}/api/og?id=${id}`;
        if (!planTitle) url += '&showTitle=false';
        if (logo) url += '&showLogo=true';
        url += `&lang=${i18n.language === 'en' ? 'en' : 'ja'}`;
        return url;
    };

    // モーダルが開いたら共有URLを生成
    useEffect(() => {
        if (!isOpen) return;
        useTutorialStore.getState().completeEvent('share:modal-opened');
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
            // ロゴが有効ならストレージパスをサーバーに送る（サーバー側でfirebase-adminでダウンロード）
            if (showLogo && teamLogoUrl && user) {
                body.logoStoragePath = `users/${user.uid}/team-logo.jpg`;
            }
            body.lang = i18n.language === 'en' ? 'en' : 'ja';

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

    // 既存shareIdのロゴを更新（PUT）
    const updateShareLogo = async (withLogo: boolean) => {
        if (!shareIdRef) return;
        setImageLoaded(false);
        try {
            const body: any = { shareId: shareIdRef };
            if (withLogo && teamLogoUrl && user) {
                body.logoStoragePath = `users/${user.uid}/team-logo.jpg`;
            }
            await apiFetch('/api/share', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            // プレビュー画像を再読み込み（キャッシュ回避のためタイムスタンプ付与）
            setOgImageUrl(buildOgUrl(shareIdRef, showPlanTitle, withLogo) + `&t=${Date.now()}`);
        } catch (err) {
            console.error('Share logo update failed:', err);
            showToast(t('app.share_failed'));
            setImageLoaded(true); // エラー時にボタンを再有効化
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
        // shareデータのロゴを更新（ON→ロゴ埋め込み、OFF→ロゴ削除）
        updateShareLogo(next);
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
            setShowLogo(true);
            // 既存shareデータのロゴを上書き更新
            await updateShareLogo(true);
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

    // ロゴ削除処理
    const handleLogoDelete = async () => {
        if (!user) return;
        try {
            await deleteTeamLogo(user.uid);
            setTeamLogoUrl(null);
            setShowLogo(false);
            showToast(t('team_logo.remove_success'));
            // 既存shareデータからロゴを削除
            await updateShareLogo(false);
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

    if (!isOpen) return <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />;

    return (<>
        {createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
        >
            <div
                className="relative glass-tier3 rounded-2xl shadow-2xl w-[420px] max-w-[90vw] overflow-hidden"
                style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
                onClick={e => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-app-border bg-app-surface2/40">
                    <h3 className="text-app-2xl font-bold text-app-text">
                        {isBundle
                            ? t('app.share_bundle_title')
                            : t('app.share_modal_title')
                        }
                    </h3>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* OGPプレビュー（ロゴD&D対応） */}
                <div className="px-5 py-4">
                    <div
                        className={clsx(
                            "relative w-full aspect-[1200/630] bg-app-surface2/60 rounded-lg overflow-hidden border transition-colors",
                            user && dragging
                                ? "border-app-text border-dashed"
                                : "border-app-border"
                        )}
                        onDragEnter={user ? (e) => {
                            e.preventDefault();
                            dragCountRef.current++;
                            setDragging(true);
                        } : undefined}
                        onDragOver={user ? (e) => { e.preventDefault(); } : undefined}
                        onDragLeave={user ? () => {
                            dragCountRef.current--;
                            if (dragCountRef.current <= 0) {
                                dragCountRef.current = 0;
                                setDragging(false);
                            }
                        } : undefined}
                        onDrop={user ? (e) => {
                            e.preventDefault();
                            dragCountRef.current = 0;
                            setDragging(false);
                            const file = e.dataTransfer.files[0];
                            if (file) processLogoFile(file);
                        } : undefined}
                    >
                        {/* D&Dオーバーレイ（ログインユーザーのみ） */}
                        {user && dragging && (
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
                            <img
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
                            <span className="text-app-lg text-app-text-muted group-hover:text-app-text transition-colors">
                                {t('app.include_plan_title')}
                            </span>
                        </button>
                    </div>
                )}

                {/* 非ログイン時のさりげない案内 */}
                {!user && (
                    <div className="px-5 pb-2">
                        <p className="text-app-base text-app-text-muted text-center leading-relaxed">
                            {t('app.share_guest_hint')
                                .split(/<\/?login>/)
                                .map((part, i) =>
                                    i === 1 ? (
                                        <button
                                            key="login"
                                            onClick={() => setShowLoginModal(true)}
                                            className="underline hover:text-app-text transition-colors cursor-pointer"
                                        >
                                            {part}
                                        </button>
                                    ) : (
                                        <span key={i}>{part}</span>
                                    )
                                )}
                        </p>
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
                                <span className="text-app-lg text-app-text-muted group-hover:text-app-text transition-colors">
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
                                        onClick={handleLogoDelete}
                                        disabled={uploading}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer border border-app-border"
                                    >
                                        <Trash2 size={11} />
                                        {t('team_logo.remove')}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => !uploading && fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-app-md font-bold border border-app-border text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer"
                                >
                                    {uploading ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                        <Upload size={12} />
                                    )}
                                    {uploading ? t('team_logo.uploading') : t('team_logo.upload')}
                                </button>
                            )}
                            <span className="text-app-base text-app-text-muted ml-auto">
                                {t('team_logo.format_hint')}
                            </span>
                        </div>

                        {/* UGC注意書き */}
                        <div className="flex items-start gap-1.5 text-app-xs text-app-text-muted leading-relaxed">
                            <span className="shrink-0 mt-px">ⓘ</span>
                            <div>
                                <p>{t('team_logo.usage_notice')}</p>
                                <p>
                                    <Trans
                                        i18nKey="team_logo.usage_notice_terms"
                                        components={{
                                            termsLink: <Link to="/terms" target="_blank" className="underline hover:text-app-text transition-colors" />
                                        }}
                                    />
                                </p>
                            </div>
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
                    {/* 生成中の状態表示 */}
                    {!imageLoaded && shareUrl && (
                        <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-app-2xl font-bold bg-app-surface2 text-app-text-muted cursor-not-allowed">
                            <Loader2 size={16} className="animate-spin" />
                            {t('app.share_generating')}
                        </div>
                    )}

                    {/* URLコピー（生成中は非表示） */}
                    {(imageLoaded || !shareUrl) && (
                        <button
                            onClick={handleCopy}
                            disabled={!shareUrl}
                            className={clsx(
                                "flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-app-2xl font-bold transition-all",
                                shareUrl
                                    ? "bg-app-toggle text-app-toggle-text hover:opacity-80 active:scale-[0.98] cursor-pointer"
                                    : "bg-app-surface2 text-app-text-muted cursor-not-allowed"
                            )}
                        >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            {copied
                                ? t('app.link_copied')
                                : t('app.copy_share_url')
                            }
                        </button>
                    )}

                    {/* X共有（生成中は非表示） */}
                    {(imageLoaded || !shareUrl) && (
                        <button
                            onClick={handleShareX}
                            disabled={!shareUrl}
                            className={clsx(
                                "flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-app-2xl font-bold transition-all border",
                                shareUrl
                                    ? "border-app-border text-app-text hover:bg-app-text/10 active:scale-[0.98] cursor-pointer"
                                    : "border-app-border text-app-text-muted cursor-not-allowed"
                            )}
                        >
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            {t('app.share_on_x')}
                            <ExternalLink size={12} className="text-app-text-muted" />
                        </button>
                    )}

                    {/* 画像無しで共有（URLだけコピー） */}
                    {shareUrl && (
                        <button
                            onClick={handleCopy}
                            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-app-lg text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer"
                        >
                            <Copy size={12} />
                            {t('app.share_url_only')}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
        )}
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>);
};
