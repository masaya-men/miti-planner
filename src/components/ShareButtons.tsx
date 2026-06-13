import React from 'react';
import clsx from 'clsx';
import { Share2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './ui/Tooltip';
import { ShareModal } from './ShareModal';
import { ShareChoiceModal } from './collab/ShareChoiceModal';
import { OwnerCollabPanel } from './collab/OwnerCollabPanel';
import { ParticipantDots } from './collab/ParticipantDots';
import { LoginModal } from './LoginModal';
import { useCollabSessionStore } from '../store/useCollabSessionStore';
import { useCollabPresenceStore } from '../store/useCollabPresenceStore';
import { useAuthStore } from '../store/useAuthStore';
import type { SavedPlan } from '../types';
import { useTutorialStore } from '../store/useTutorialStore';

const iconBtnBase = "group w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95";
const hoverInvert = "hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text";
const iconBtnDefault = `bg-transparent border-app-border text-app-text ${hoverInvert}`;

interface ShareButtonsProps {
    contentLabel: string | null;
    currentPlan: SavedPlan | undefined;
}

type View = 'none' | 'choice' | 'copy' | 'panel';

export const ShareButtons: React.FC<ShareButtonsProps> = ({ contentLabel, currentPlan }) => {
    const { t } = useTranslation();
    const [view, setView] = React.useState<View>('none');
    const [showLogin, setShowLogin] = React.useState(false);
    const [collabBusy, setCollabBusy] = React.useState(false);
    const { active, start } = useCollabSessionStore();
    const rosterCount = useCollabPresenceStore(s => s.roster.length);
    const { user, isAdmin } = useAuthStore();

    // ON 判定は「プランが collab-ON か」(プラン属性・サイドバーバッジと同基準) に寄せる。
    // active(ライブ接続) は ON の部分集合。Task6 自動接続でほぼ即一致するが、接続前でも ON を見せる(A案)。
    const isOn = active || !!currentPlan?.activeCollabRoomToken;

    const openShareUI = () => {
        const { completed, isActive } = useTutorialStore.getState();
        if (!completed['share'] && !isActive) useTutorialStore.getState().startTutorial('share');
        // 共同編集 UI は本番検証中のため管理者のみに開放するゲート。
        // 一般ユーザーは従来どおりコピー共有へ直行 (2択を見せない)。
        // 正式公開時はこの分岐を外すだけで全ユーザーに開放できる。
        if (!isAdmin) { setView('copy'); return; }
        // ON のプラン=パネル直行。OFF=2択。
        setView(isOn ? 'panel' : 'choice');
    };

    const handleCollab = async () => {
        if (collabBusy) return;                           // 二重押し防止(発行が遅いと連打→多重発行=満員誤判定の原因)
        if (!user) { setShowLogin(true); return; }      // 未ログインはログイン導線
        if (!currentPlan) return;                         // 保存済プランが無ければ不可
        setCollabBusy(true);
        try {
            await start(currentPlan.id);
            setView('panel');
        } finally {
            setCollabBusy(false);
        }
    };

    return (
        <>
            <Tooltip content={isOn ? t('collab.chip_active') : t('app.share')}>
                {isOn ? (
                    <button
                        onClick={openShareUI}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-app-text/40 bg-app-text/10 text-app-text font-bold text-app-sm cursor-pointer active:scale-95 transition-all"
                    >
                        <Users size={13} /> {rosterCount > 0 ? t('collab.chip_active_count', { count: rosterCount }) : t('collab.chip_active')}
                        {/* #3e: オーナーも設定を開かず参加者ドットを一目で見られるように */}
                        <ParticipantDots size={8} />
                    </button>
                ) : (
                    <button
                        data-tutorial="share-copy-btn"
                        onClick={openShareUI}
                        className={clsx(iconBtnBase, iconBtnDefault, "w-8 h-8")}
                    >
                        <Share2 size={14} />
                    </button>
                )}
            </Tooltip>

            {view === 'choice' && (
                <ShareChoiceModal
                    onCopy={() => setView('copy')}
                    onCollab={handleCollab}
                    onClose={() => setView('none')}
                    collabBusy={collabBusy}
                />
            )}

            <ShareModal
                isOpen={view === 'copy'}
                onClose={() => setView('none')}
                contentLabel={contentLabel}
                currentPlan={currentPlan}
            />

            {view === 'panel' && currentPlan && (
                <OwnerCollabPanel planId={currentPlan.id} onClose={() => setView('none')} />
            )}

            <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
        </>
    );
};
