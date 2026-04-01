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

    // share チュートリアルが完了 or キャンセルされたらモーダルを閉じる
    const activeTutorialId = useTutorialStore(s => s.activeTutorialId);
    const wasShareTutorial = useRef(false);

    useEffect(() => {
        if (activeTutorialId === 'share') {
            wasShareTutorial.current = true;
        } else if (wasShareTutorial.current) {
            // share チュートリアルが終了した（完了 or キャンセル）
            wasShareTutorial.current = false;
            setModalOpen(false);
        }
    }, [activeTutorialId]);

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
