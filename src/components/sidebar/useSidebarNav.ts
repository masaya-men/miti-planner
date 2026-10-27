import React, { useState } from 'react';
import { getContentById } from '../../data/contentRegistry';
import { usePlanStore } from '../../store/usePlanStore';

export type SidebarTab = 'savage' | 'ultimate' | 'other' | 'archive';

export function useSidebarNav(tutorialActive: boolean) {
    // 現在のプランからレベル・カテゴリ・選択アイテムを初期化
    const [selectedContentId, setSelectedContentId] = useState<string | null>(() => {
        const planStore = usePlanStore.getState();
        if (planStore.currentPlanId) {
            const currentPlan = planStore.plans.find(p => p.id === planStore.currentPlanId);
            return currentPlan?.contentId ?? null;
        }
        return null;
    });
    const [activeTab, setActiveTab] = useState<SidebarTab>(() => {
        if (selectedContentId) {
            const content = getContentById(selectedContentId);
            if (content) {
                if (content.category === 'savage') return 'savage';
                if (content.category === 'ultimate') return 'ultimate';
                return 'other';
            }
        }
        return 'savage';
    });
    const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState(false);
    const [backupExportOpen, setBackupExportOpen] = useState(false);
    const [backupRestoreOpen, setBackupRestoreOpen] = useState(false);
    // 右クリックコンテキストメニュー用ステート
    const [contextMenu, setContextMenu] = useState<{
        x: number; y: number; planId: string; planTitle: string; contentId: string | null;
    } | null>(null);
    // 自動アーカイブ確認ダイアログ用ステート
    const [archivePrompt, setArchivePrompt] = useState<{ planIds: string[] } | null>(null);

    // チュートリアル戻るボタン用: ストアからモーダルを閉じるカスタムイベント
    React.useEffect(() => {
        const handleClose = () => setIsNewPlanModalOpen(false);
        window.addEventListener('tutorial:close-new-plan-modal', handleClose);
        return () => window.removeEventListener('tutorial:close-new-plan-modal', handleClose);
    }, []);

    // チュートリアル開始時に零式タブを自動選択
    React.useEffect(() => {
        if (tutorialActive) {
            setActiveTab('savage');
        }
    }, [tutorialActive]);

    // チュートリアル復帰時にサイドバーのタブを同期
    React.useEffect(() => {
        const handleRestored = (e: Event) => {
            const { contentId } = (e as CustomEvent).detail ?? {};
            if (contentId) {
                const c = getContentById(contentId);
                if (c) {
                    if (c.category === 'savage') setActiveTab('savage');
                    else if (c.category === 'ultimate') setActiveTab('ultimate');
                    else setActiveTab('other');
                    setSelectedContentId(contentId);
                }
            }
        };
        window.addEventListener('tutorial:plan-restored', handleRestored);
        return () => window.removeEventListener('tutorial:plan-restored', handleRestored);
    }, []);

    return {
        selectedContentId,
        setSelectedContentId,
        activeTab,
        setActiveTab,
        isNewPlanModalOpen,
        setIsNewPlanModalOpen,
        backupExportOpen,
        setBackupExportOpen,
        backupRestoreOpen,
        setBackupRestoreOpen,
        contextMenu,
        setContextMenu,
        archivePrompt,
        setArchivePrompt,
    };
}
