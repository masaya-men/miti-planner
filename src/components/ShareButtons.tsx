import React, { useRef, useEffect } from 'react';
import clsx from 'clsx';
import { Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './ui/Tooltip';
import { ShareModal } from './ShareModal';
import type { SavedPlan } from '../types';
import { useTutorialStore } from '../store/useTutorialStore';

const iconBtnBase = "group w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95";
const hoverInvert = "hover:bg-app-text hover:border-app-text hover:text-app-bg";
const iconBtnDefault = `bg-transparent border-app-border text-app-text ${hoverInvert}`;

interface ShareButtonsProps {
    contentLabel: string | null;
    currentPlan: SavedPlan | undefined;
}

export const ShareButtons: React.FC<ShareButtonsProps> = ({ contentLabel, currentPlan }) => {
    const { t } = useTranslation();
    const [modalOpen, setModalOpen] = React.useState(false);

    const shareCompleted = useTutorialStore(s => s.completed['share']);
    const prevShareCompleted = useRef(shareCompleted);

    useEffect(() => {
        // share チュートリアルが今完了した → モーダルを閉じる
        if (shareCompleted && !prevShareCompleted.current) {
            setModalOpen(false);
        }
        prevShareCompleted.current = shareCompleted;
    }, [shareCompleted]);

    return (
        <>
            <Tooltip content={t('app.share')}>
                <button
                    data-tutorial="share-copy-btn"
                    onClick={() => setModalOpen(true)}
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
