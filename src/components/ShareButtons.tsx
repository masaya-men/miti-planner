import React from 'react';
import clsx from 'clsx';
import { Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './ui/Tooltip';
import { ShareModal } from './ShareModal';
import type { SavedPlan } from '../types';
import { useTutorialStore } from '../store/useTutorialStore';

const iconBtnBase = "group w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95";
const hoverInvert = "hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text";
const iconBtnDefault = `bg-transparent border-app-border text-app-text ${hoverInvert}`;

interface ShareButtonsProps {
    contentLabel: string | null;
    currentPlan: SavedPlan | undefined;
}

export const ShareButtons: React.FC<ShareButtonsProps> = ({ contentLabel, currentPlan }) => {
    const { t } = useTranslation();
    const [modalOpen, setModalOpen] = React.useState(false);

    const handleClick = () => {
        setModalOpen(true);
        const { completed, isActive } = useTutorialStore.getState();
        if (!completed['share'] && !isActive) {
            useTutorialStore.getState().startTutorial('share');
        }
    };

    return (
        <>
            <Tooltip content={t('app.share')}>
                <button
                    data-tutorial="share-copy-btn"
                    onClick={handleClick}
                    className={clsx(iconBtnBase, iconBtnDefault, "w-8 h-8")}
                >
                    <Share2 size={14} />
                </button>
            </Tooltip>

            <ShareModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                contentLabel={contentLabel}
                currentPlan={currentPlan}
            />
        </>
    );
};
