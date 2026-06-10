import React from 'react';
import clsx from 'clsx';
import { Share2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './ui/Tooltip';
import { ShareModal } from './ShareModal';
import { ShareChoiceModal } from './collab/ShareChoiceModal';
import { OwnerCollabPanel } from './collab/OwnerCollabPanel';
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
    const { active, start } = useCollabSessionStore();
    const rosterCount = useCollabPresenceStore(s => s.roster.length);
    const { user, isAdmin } = useAuthStore();

    const openShareUI = () => {
        const { completed, isActive } = useTutorialStore.getState();
        if (!completed['share'] && !isActive) useTutorialStore.getState().startTutorial('share');
        // 共同編集 UI は本番検証中のため管理者のみに開放するゲート。
        // 一般ユーザーは従来どおりコピー共有へ直行 (2択を見せない)。
        // 正式公開時はこの分岐を外すだけで全ユーザーに開放できる。
        if (!isAdmin) { setView('copy'); return; }
        // 共同編集中はチップ=パネル直行。通常時は2択。
        setView(active ? 'panel' : 'choice');
    };

    const handleCollab = async () => {
        if (!user) { setShowLogin(true); return; }      // 未ログインはログイン導線
        if (!currentPlan) return;                         // 保存済プランが無ければ不可
        await start(currentPlan.id);
        setView('panel');
    };

    return (
        <>
            <Tooltip content={active ? t('collab.chip_active') : t('app.share')}>
                {active ? (
                    <button
                        onClick={openShareUI}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-app-text/40 bg-app-text/10 text-app-text font-bold text-app-sm cursor-pointer active:scale-95 transition-all"
                    >
                        <Users size={13} /> {rosterCount > 0 ? t('collab.chip_active_count', { count: rosterCount }) : t('collab.chip_active')}
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
