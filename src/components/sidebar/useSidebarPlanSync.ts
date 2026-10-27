import React, { useState } from 'react';
import { useMitigationStore } from '../../store/useMitigationStore';
import { getContentById, getCurrentExpansionLevel } from '../../data/contentRegistry';
import type { ContentDefinition } from '../../types';
import { usePlanStore } from '../../store/usePlanStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../../store/useAuthStore';
import type { useSidebarNav } from './useSidebarNav';

type Nav = ReturnType<typeof useSidebarNav>;

export function useSidebarPlanSync({ setSelectedContentId, setActiveTab, setArchivePrompt }: Pick<Nav, 'setSelectedContentId' | 'setActiveTab' | 'setArchivePrompt'>) {
    // 名前入力ダイアログ用ステート
    const [pendingContent, setPendingContent] = useState<ContentDefinition | null>(null);
    const [pendingPlanName, setPendingPlanName] = useState('');
    const user = useAuthStore(s => s.user);
    const [showLoginModal, setShowLoginModal] = useState(false);
    // ローディング状態（テンプレート読み込み・プラン切替中）

    const { plans, currentPlanId, setCurrentPlanId, updatePlan } = usePlanStore(
        useShallow(s => ({ plans: s.plans, currentPlanId: s.currentPlanId, setCurrentPlanId: s.setCurrentPlanId, updatePlan: s.updatePlan }))
    );
    const { getSnapshot, loadSnapshot } = useMitigationStore();

    // currentPlanId が切替わったときだけ selectedContentId / activeTab を追従させる。
    // plans 配列の変化（削除・コピー等）では発火させない → ユーザー選択中のタブを保持する。
    // currentPlanId === null への遷移時もタブを触らない（ユーザー意図を尊重）。
    React.useEffect(() => {
        if (!currentPlanId) return;
        const plan = plans.find(p => p.id === currentPlanId);
        if (!plan?.contentId) return;
        setSelectedContentId(plan.contentId);
        const content = getContentById(plan.contentId);
        if (content) {
            if (content.category === 'savage') setActiveTab('savage');
            else if (content.category === 'ultimate') setActiveTab('ultimate');
            else setActiveTab('other');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPlanId]);

    // 過去拡張の零式プランを自動アーカイブ（通知のみ）
    React.useEffect(() => {
        const currentLevel = getCurrentExpansionLevel();
        const oldSavagePlans = plans.filter(p =>
            !p.archived &&
            p.category === 'savage' &&
            p.level !== undefined &&
            p.level < currentLevel
        );
        const doneKey = `archive-auto-done-${currentLevel}`;
        const done = localStorage.getItem(doneKey);
        if (oldSavagePlans.length > 0 && !done) {
            // 自動でアーカイブ実行
            usePlanStore.getState().archivePlans(oldSavagePlans.map(p => p.id)).then(() => {
                localStorage.setItem(doneKey, 'true');
                setArchivePrompt({ planIds: oldSavagePlans.map(p => p.id) });
            });
        }
    }, [plans]);

    return {
        pendingContent,
        setPendingContent,
        pendingPlanName,
        setPendingPlanName,
        user,
        showLoginModal,
        setShowLoginModal,
        plans,
        currentPlanId,
        setCurrentPlanId,
        updatePlan,
        getSnapshot,
        loadSnapshot,
    };
}
