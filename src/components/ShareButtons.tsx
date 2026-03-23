import React from 'react';
import clsx from 'clsx';
import { Link2, Loader2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../store/useMitigationStore';
import { Tooltip } from './ui/Tooltip';
import { showToast } from './Toast';
import type { SavedPlan } from '../types';

const iconBtnBase = "group w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95";
const hoverInvert = "hover:bg-app-text hover:border-app-text hover:text-app-bg";
const iconBtnDefault = `bg-transparent border-app-border text-app-text ${hoverInvert}`;

interface ShareButtonsProps {
    contentLabel: string | null;
    currentPlan: SavedPlan | undefined;
}

export const ShareButtons: React.FC<ShareButtonsProps> = ({ contentLabel, currentPlan }) => {
    const { t } = useTranslation();
    const [sharing, setSharing] = React.useState(false);
    const [lastShareUrl, setLastShareUrl] = React.useState<string | null>(null);
    const [copied, setCopied] = React.useState(false);

    const createShareUrl = async (): Promise<string | null> => {
        const snapshot = useMitigationStore.getState().getSnapshot();
        try {
            const res = await fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planData: snapshot,
                    title: currentPlan?.title || '',
                    contentId: currentPlan?.contentId || null,
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { shareId } = await res.json();
            const url = `${window.location.origin}/share/${shareId}`;
            setLastShareUrl(url);
            return url;
        } catch (err) {
            console.error('Share failed:', err);
            showToast(t('app.share_failed') || '共有リンクの生成に失敗しました');
            return null;
        }
    };

    const handleShareX = async () => {
        if (sharing) return;
        setSharing(true);
        try {
            const url = lastShareUrl || await createShareUrl();
            if (!url) return;
            const text = `${contentLabel || 'LoPo'} - FF14 軽減プランナー`;
            window.open(
                `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
                '_blank'
            );
        } finally {
            setSharing(false);
        }
    };

    const handleCopyLink = async () => {
        if (sharing) return;
        setSharing(true);
        try {
            const url = lastShareUrl || await createShareUrl();
            if (!url) return;
            await navigator.clipboard.writeText(url);
            setCopied(true);
            showToast(t('app.link_copied'));
            setTimeout(() => setCopied(false), 2000);
        } finally {
            setSharing(false);
        }
    };

    // 軽減内容が変わったらキャッシュをクリア
    const timelineMitigations = useMitigationStore(s => s.timelineMitigations);
    React.useEffect(() => {
        setLastShareUrl(null);
    }, [timelineMitigations]);

    return (
        <div className="flex items-center gap-1 shrink-0">
            {/* X (Twitter) 共有 */}
            <Tooltip content={t('app.share_x')}>
                <button
                    onClick={handleShareX}
                    disabled={sharing}
                    className={clsx(iconBtnBase, iconBtnDefault, "w-8 h-8", sharing && "opacity-50 pointer-events-none")}
                >
                    {sharing ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                    )}
                </button>
            </Tooltip>

            {/* リンクコピー */}
            <Tooltip content={t('app.copy_link')}>
                <button
                    onClick={handleCopyLink}
                    disabled={sharing}
                    className={clsx(iconBtnBase, iconBtnDefault, "w-8 h-8", sharing && "opacity-50 pointer-events-none")}
                >
                    {sharing ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : copied ? (
                        <Check size={14} className="text-green-500" />
                    ) : (
                        <Link2 size={14} />
                    )}
                </button>
            </Tooltip>
        </div>
    );
};
