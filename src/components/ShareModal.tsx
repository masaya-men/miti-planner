import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check, Loader2, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { useMitigationStore } from '../store/useMitigationStore';
import { showToast } from './Toast';
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

    const isBundle = bundlePlans && bundlePlans.length > 0;

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

            const res = await fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { shareId } = await res.json();
            const url = `${window.location.origin}/share/${shareId}`;
            setShareUrl(url);
            setOgImageUrl(`${window.location.origin}/api/og?id=${shareId}`);
        } catch (err) {
            console.error('Share failed:', err);
            showToast(t('app.share_failed') || '共有リンクの生成に失敗しました');
        } finally {
            setLoading(false);
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

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative bg-app-bg border border-app-border rounded-2xl shadow-2xl w-[420px] max-w-[90vw] overflow-hidden"
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

                {/* OGPプレビュー */}
                <div className="px-5 py-4">
                    <div className="relative w-full aspect-[1200/630] bg-app-surface2 rounded-lg overflow-hidden border border-app-border">
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
        </div>
    );
};
