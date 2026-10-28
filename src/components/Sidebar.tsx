import { backdropClose } from '../utils/backdropClose';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { ArchivePromptModal } from './ArchivePromptModal';
import { usePlanMultiSelect } from '../hooks/usePlanMultiSelect';
import { NewPlanModal } from './NewPlanModal';
import { ShareModal } from './ShareModal';
import { LoginModal } from './LoginModal';
import { useTransitionOverlay } from './ui/transitionOverlayContext';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { BackupExportModal } from './BackupExportModal';
import { BackupRestoreModal } from './BackupRestoreModal';
import { useSidebarNav } from './sidebar/useSidebarNav';
import { useSidebarSelectionBar } from './sidebar/useSidebarSelectionBar';
import { useSidebarPlanSync } from './sidebar/useSidebarPlanSync';
import { useSidebarPlanActions } from './sidebar/useSidebarPlanActions';
import { SidebarToolbar } from './sidebar/SidebarToolbar';
import { SidebarTabLists } from './sidebar/SidebarTabLists';
import { SidebarFloatingBar } from './sidebar/SidebarFloatingBar';
import { SidebarFooterBars } from './sidebar/SidebarFooterBars';
import { SidebarHandle } from './sidebar/SidebarHandle';
import { SidebarContextMenu } from './sidebar/SidebarContextMenu';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface SidebarProps {
    isOpen: boolean;
    onToggle?: () => void;
    onClose?: () => void;
    /** モバイルのボトムシート内で使う場合trueにすると、幅100%・ハンドル非表示になる */
    fullWidth?: boolean;
    /** モバイルメニューから「自動組み立て」を実行 */
    onAutoPlan?: () => void;
}

// ─────────────────────────────────────────────
// Main: Sidebar
// ─────────────────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onClose, fullWidth, onAutoPlan }) => {
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();
    const { isActive: tutorialActive, currentStepIndex } = useTutorialStore();
    const { runTransition } = useTransitionOverlay();
    const lang = contentLanguage;

    const nav = useSidebarNav(tutorialActive);
    const { selectedContentId, setSelectedContentId, activeTab, setActiveTab, isNewPlanModalOpen, setIsNewPlanModalOpen, backupExportOpen, setBackupExportOpen, backupRestoreOpen, setBackupRestoreOpen, contextMenu, setContextMenu, archivePrompt, setArchivePrompt } = nav;

    // 複数選択(まとめて共有・選択削除)は usePlanMultiSelect に集約
    const {
        multiSelect, setMultiSelect,
        toggleMode: toggleMultiSelectMode, toggleId: toggleItemId,
        bundleOpen: bundleModalOpen, bundlePlans: bundlePlansForModal,
        setBundleOpen: setBundleModalOpen, setBundlePlans: setBundlePlansForModal,
        openBundleShare: handleShareBundle, closeBundleShare, deleteSelected,
    } = usePlanMultiSelect();
    const selectionBar = useSidebarSelectionBar(multiSelect);
    const { showDeleteConfirm, setShowDeleteConfirm, floatingBarRef, floatingBarFlash, savageListRef, ultimateListRef, otherListRef, archiveListRef } = selectionBar;

    const sync = useSidebarPlanSync({ setSelectedContentId, setActiveTab, setArchivePrompt });
    const { pendingContent, pendingPlanName, setPendingPlanName, user, showLoginModal, setShowLoginModal, plans, currentPlanId, updatePlan } = sync;

    const { handleSelectContent, handleLoadPlan, handleConfirmNewPlan, handleCancelNewPlan } = useSidebarPlanActions({ t, runTransition, fullWidth, onClose, nav, sync });

    // チュートリアルのステップ1（コンテンツ選択）でサイドバーの最初のアイテムをハイライト
    const tutorialStep = useTutorialStore(s => s.getCurrentStep());
    const isTutorialContentSelect = tutorialStep?.id === 'main-1-content';

    const [isHovered, setIsHovered] = useState(false);

    return (<>
        <motion.aside
            initial={false}
            animate={{ width: fullWidth ? '100%' : isOpen ? 300 : 24 }}
            transition={fullWidth ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 22 }}
            className={clsx("h-full flex z-40 relative group/sidebar glass-tier3 glass-frame glass-border-t-0 glass-border-r-0 glass-shadow-none", !fullWidth && "shadow-sm")}
            style={fullWidth ? { width: '100%', minWidth: '100%' } : undefined}
        >
            {/* [1] サイドバー本体 (コンテンツエリア) */}
            <motion.div
                animate={{ width: fullWidth ? '100%' : isOpen ? 276 : 0 }}
                transition={fullWidth ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 22 }}
                className="h-full flex flex-col overflow-hidden"
                style={fullWidth ? { width: '100%', minWidth: '100%' } : undefined}
            >
                <div className={clsx(fullWidth ? "w-full" : "w-[276px]", "flex flex-col h-full overflow-hidden")}>
                    <SidebarToolbar
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        multiSelect={multiSelect}
                        toggleMultiSelectMode={toggleMultiSelectMode}
                        setIsNewPlanModalOpen={setIsNewPlanModalOpen}
                        fullWidth={fullWidth}
                        onAutoPlan={onAutoPlan}
                    />

                    <SidebarTabLists
                        activeTab={activeTab}
                        lang={lang}
                        multiSelect={multiSelect}
                        setMultiSelect={setMultiSelect}
                        toggleItemId={toggleItemId}
                        plans={plans}
                        currentPlanId={currentPlanId}
                        updatePlan={updatePlan}
                        selectedContentId={selectedContentId}
                        handleSelectContent={handleSelectContent}
                        handleLoadPlan={handleLoadPlan}
                        setContextMenu={setContextMenu}
                        isTutorialContentSelect={isTutorialContentSelect}
                        runTransition={runTransition}
                        savageListRef={savageListRef}
                        ultimateListRef={ultimateListRef}
                        otherListRef={otherListRef}
                        archiveListRef={archiveListRef}
                    />

                    <SidebarFloatingBar
                        multiSelect={multiSelect}
                        setMultiSelect={setMultiSelect}
                        floatingBarRef={floatingBarRef}
                        floatingBarFlash={floatingBarFlash}
                        bundleModalOpen={bundleModalOpen}
                        handleShareBundle={handleShareBundle}
                        setShowDeleteConfirm={setShowDeleteConfirm}
                    />

                    <SidebarFooterBars
                        multiSelect={multiSelect}
                        isOpen={isOpen}
                        setBackupExportOpen={setBackupExportOpen}
                        setBackupRestoreOpen={setBackupRestoreOpen}
                    />
                </div>
            </motion.div>

            {/* [2] ── 常設ハンドル領域 ── */}
            <SidebarHandle
                fullWidth={fullWidth}
                isOpen={isOpen}
                onToggle={onToggle}
                tutorialActive={tutorialActive}
                currentStepIndex={currentStepIndex}
                isHovered={isHovered}
                setIsHovered={setIsHovered}
                setBackupExportOpen={setBackupExportOpen}
            />
            <NewPlanModal isOpen={isNewPlanModalOpen} onClose={(created) => {
                setIsNewPlanModalOpen(false);
                if (created) {
                    setSelectedContentId(created.contentId);
                    useMitigationStore.getState().setCurrentLevel(created.level);
                    if (created.category === 'savage') setActiveTab('savage');
                    else if (created.category === 'ultimate') setActiveTab('ultimate');
                    else setActiveTab('other');
                    // 作成されたコンテンツが見える位置までスクロール
                    setTimeout(() => {
                        const el = document.querySelector(`[data-content-id="${created.contentId}"]`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 200);
                }
            }} />
            <ShareModal
                isOpen={bundleModalOpen}
                onClose={closeBundleShare}
                contentLabel={null}
                currentPlan={undefined}
                bundlePlans={bundlePlansForModal}
            />

            {/* 名前入力ダイアログ — createPortalでbodyに配置（motion.aside内のtransformでfixedが効かない問題を回避） */}
            {pendingContent && createPortal(
                <div
                    className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
                    {...backdropClose(handleCancelNewPlan)}
                >
                    <div
                        className="relative float-surface rounded-2xl w-[360px] max-w-[90vw] overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-app-border">
                            <h3 className="text-app-2xl font-bold text-app-text">
                                {t('sidebar.name_dialog_title')}
                            </h3>
                            <p className="text-app-md text-app-text-muted mt-1">
                                {t('sidebar.name_dialog_desc')}
                            </p>
                        </div>
                        <div className="px-5 py-4">
                            <input
                                autoFocus
                                type="text"
                                value={pendingPlanName}
                                onChange={e => setPendingPlanName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && pendingPlanName.trim()) handleConfirmNewPlan();
                                    if (e.key === 'Escape') handleCancelNewPlan();
                                }}
                                onFocus={e => e.target.select()}
                                className="w-full px-4 py-3 bg-app-surface2 border border-app-border rounded-xl text-[16px] md:text-app-2xl text-app-text font-bold outline-none focus:border-app-text/40 transition-colors"
                            />
                        </div>
                        <div className="px-5 pb-4 flex flex-col gap-3">
                            {!user && (
                                <p className="text-app-base text-app-text-muted text-center leading-relaxed">
                                    {t('new_plan.guest_hint_short')
                                        .split(/<\/?login>/)
                                        .map((part, i) =>
                                            i === 1 ? (
                                                <button
                                                    key="login"
                                                    onClick={() => setShowLoginModal(true)}
                                                    className="underline hover:text-app-text transition-colors cursor-pointer"
                                                >
                                                    {part}
                                                </button>
                                            ) : (
                                                <span key={i}>{part}</span>
                                            )
                                        )}
                                </p>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCancelNewPlan}
                                    className="flex-1 py-2.5 rounded-xl border border-app-border text-app-lg font-bold text-app-text hover:bg-app-surface2 transition-colors cursor-pointer"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={handleConfirmNewPlan}
                                    disabled={!pendingPlanName.trim()}
                                    className={clsx(
                                        "flex-[2] py-2.5 rounded-xl text-app-lg font-bold transition-all cursor-pointer",
                                        pendingPlanName.trim()
                                            ? "bg-app-toggle text-app-toggle-text hover:opacity-80 active:scale-[0.98]"
                                            : "bg-app-surface2 text-app-text-muted cursor-not-allowed"
                                    )}
                                >
                                    {t('sidebar.create_plan_button')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
            {/* 削除確認モーダル — NewPlanModalと同じ温度感 */}
            {showDeleteConfirm && createPortal(
                <div
                    className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
                    {...backdropClose(() => setShowDeleteConfirm(false))}
                >
                    <div
                        className="relative w-full max-w-[400px] float-surface rounded-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* ヘッダー */}
                        <div className="px-6 py-5 border-b border-glass-border/30 flex items-center justify-between bg-glass-header/30">
                            <h2 className="text-app-xl font-black text-app-text tracking-widest flex items-center gap-3 uppercase">
                                <span className="w-1.5 h-4 bg-app-toggle rounded-full" />
                                {t('sidebar.delete_confirm_title')}
                            </h2>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="p-2 rounded-full text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* 本文 */}
                        <div className="p-6 space-y-3">
                            <p className="text-app-xl font-bold text-app-text text-center">
                                {t('sidebar.delete_confirm', { count: multiSelect.selectedIds.length })}
                            </p>
                            <p className="text-app-md text-app-text-muted text-center">
                                {t('sidebar.delete_warning')}
                            </p>
                        </div>

                        {/* フッター */}
                        <div className="p-6 bg-glass-card/10 border-t border-glass-border/20 flex gap-4">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3.5 rounded-2xl border border-glass-border/40 text-app-md font-black text-app-text hover:bg-glass-hover transition-all cursor-pointer uppercase tracking-widest active:scale-95"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    void deleteSelected();
                                    setShowDeleteConfirm(false);
                                }}
                                className="flex-[2] py-3.5 rounded-2xl text-app-md font-black bg-app-red text-white hover:bg-app-red-hover transition-all cursor-pointer uppercase tracking-[0.3em] active:scale-95"
                            >
                                {t('sidebar.delete')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </motion.aside>
            {/* 右クリックコンテキストメニュー */}
            {contextMenu && (
                <SidebarContextMenu
                    contextMenu={contextMenu}
                    setContextMenu={setContextMenu}
                    plans={plans}
                    setBundleModalOpen={setBundleModalOpen}
                    setBundlePlansForModal={setBundlePlansForModal}
                />
            )}
            {/* 自動アーカイブ通知ダイアログ */}
            <ArchivePromptModal
                isOpen={archivePrompt !== null}
                planCount={archivePrompt?.planIds.length ?? 0}
                onClose={() => setArchivePrompt(null)}
            />
            <BackupExportModal isOpen={backupExportOpen} onClose={() => setBackupExportOpen(false)} />
            <BackupRestoreModal isOpen={backupRestoreOpen} onClose={() => setBackupRestoreOpen(false)} />
    </>);
};
