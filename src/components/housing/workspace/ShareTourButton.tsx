import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Check } from 'lucide-react';

export interface ShareTourButtonProps {
    tourId: string;
}

export const ShareTourButton: React.FC<ShareTourButtonProps> = ({ tourId }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        const url = `${window.location.origin}/housing/tour/${tourId}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard API unavailable (older browsers / insecure origins).
            // Plan F will hook up a toast fallback.
        }
    };

    return (
        <button
            type="button"
            onClick={copy}
            aria-label={t('housing.workspace.tour.share_aria')}
            data-copied={copied}
            className="housing-share-tour-btn"
        >
            {copied ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
            <span>{copied ? t('housing.workspace.tour.copied') : t('housing.workspace.tour.share')}</span>
        </button>
    );
};
