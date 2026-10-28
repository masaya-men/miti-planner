import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Loader2, ExternalLink } from 'lucide-react';
import { showToast } from '../toastBus';
import { ModalButton } from '../ui/ModalParts';

interface ShareActionsProps {
    shareUrl: string | null;
    imageLoaded: boolean;
    contentLabel: string | null;
}

/** アクションボタン: URL コピー・X 共有・URL だけコピー */
export const ShareActions: React.FC<ShareActionsProps> = ({ shareUrl, imageLoaded, contentLabel }) => {
    const { t } = useTranslation();
    // モーダルを開くたびに作り直される(閉じている間は描かれない)ので、開いた時は必ず未コピー
    const [copied, setCopied] = useState(false);

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

    return (
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
                <ModalButton variant="primary" onClick={handleCopy} disabled={!shareUrl} className="w-full">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied
                        ? t('app.link_copied')
                        : t('app.copy_share_url')
                    }
                </ModalButton>
            )}

            {/* X共有（生成中は非表示） */}
            {(imageLoaded || !shareUrl) && (
                <ModalButton variant="secondary" onClick={handleShareX} disabled={!shareUrl} className="w-full">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    {t('app.share_on_x')}
                    <ExternalLink size={12} className="text-app-text-muted" />
                </ModalButton>
            )}

            {/* 画像無しで共有（URLだけコピー） */}
            {shareUrl && (
                <ModalButton variant="secondary" onClick={handleCopy} className="w-full">
                    <Copy size={12} />
                    {t('app.share_url_only')}
                </ModalButton>
            )}
        </div>
    );
};
