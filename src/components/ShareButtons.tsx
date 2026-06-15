import React from 'react';
import clsx from 'clsx';
import { Share2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './ui/Tooltip';
import { ParticipantDots } from './collab/ParticipantDots';
import { PresenceControls } from './collab/PresenceControls';
import { useShareFlow } from './collab/useShareFlow';
import type { SavedPlan } from '../types';

const iconBtnBase = "group w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95";
const hoverInvert = "hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text";
const iconBtnDefault = `bg-transparent border-app-border text-app-text ${hoverInvert}`;

interface ShareButtonsProps {
    contentLabel: string | null;
    currentPlan: SavedPlan | undefined;
}

export const ShareButtons: React.FC<ShareButtonsProps> = ({ contentLabel, currentPlan }) => {
    const { t } = useTranslation();
    // 共有フロー本体(状態機械 + モーダル)はフックへ委譲。PC はカーソル維持(hideCursor 渡さない)。
    const { openShareUI, isOn, liveCount, active, modals } = useShareFlow({ contentLabel, currentPlan });

    return (
        <>
            {isOn ? (
                // チップ自体には tooltip を付けない(ドットのホバー名を妨げないため)。
                <button
                    onClick={openShareUI}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-app-text/40 bg-app-text/10 text-app-text font-bold text-app-sm cursor-pointer active:scale-95 transition-all"
                >
                    <Users size={13} /> {liveCount > 0 ? t('collab.chip_active_count', { count: liveCount }) : t('collab.chip_active')}
                    {/* #3e: オーナーも設定を開かず参加者ドットを一目で見られるように */}
                    <ParticipantDots size={8} />
                </button>
            ) : (
                <Tooltip content={t('app.share')}>
                    <button
                        data-tutorial="share-copy-btn"
                        onClick={openShareUI}
                        className={clsx(iconBtnBase, iconBtnDefault, "w-8 h-8")}
                    >
                        <Share2 size={14} />
                    </button>
                </Tooltip>
            )}

            {/* ③ オーナーも共同編集中はヘッダーでカーソル ON/OFF と目印アイコンをサクッと操作できる
                 (閲覧者ヘッダーの CollabViewerCluster と同じ compact 行)。接続確立(active)時のみ。 */}
            {active && <PresenceControls compact />}

            {modals}
        </>
    );
};
