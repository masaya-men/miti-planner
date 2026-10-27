import { backdropClose } from '../utils/backdropClose';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { CATEGORY_LABELS, getProjectLabel, getContentById, getSavageForCurrentExpansion, getAllUltimates, getOtherContents, getSeriesById } from '../data/contentRegistry';
import { ArchivePromptModal } from './ArchivePromptModal';
import { Tooltip } from './ui/Tooltip';
import { usePlanMultiSelect } from '../hooks/usePlanMultiSelect';
import type { ContentLanguage } from '../store/useThemeStore';
import { usePlanStore } from '../store/usePlanStore';
import { useAuthStore } from '../store/useAuthStore';
import { NewPlanModal } from './NewPlanModal';
import { ShareModal } from './ShareModal';
import { LoginModal } from './LoginModal';
import { useTransitionOverlay } from './ui/TransitionOverlay';
import { SegmentButton } from './ui/SegmentButton';
import { Plus, ChevronLeft, CheckSquare, Square, Share2, Trash2, X, Pencil, Copy, HardDrive, Download, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { showToast } from './Toast';
import { BackupExportModal } from './BackupExportModal';
import { BackupRestoreModal } from './BackupRestoreModal';
import { SystemNotificationBar } from './SystemNotificationBar';
import { LocalDataSafetyBar } from './LocalDataSafetyBar';
import { LocalDataSafetyHandleButton } from './LocalDataSafetyHandleButton';
import { SystemNotificationHandleButton } from './SystemNotificationHandleButton';
import { ContextMenu } from './ui/ContextMenu';
import { decompressPlanData } from '../utils/compression';
import { useSidebarNav } from './sidebar/useSidebarNav';
import { useSidebarSelectionBar } from './sidebar/useSidebarSelectionBar';
import { useSidebarPlanSync } from './sidebar/useSidebarPlanSync';
import { useSidebarPlanActions } from './sidebar/useSidebarPlanActions';
import { ContentTreeItem } from './sidebar/ContentTreeItem';
import { FreePlanSection } from './sidebar/FreePlanSection';
import { ArchivePlanRow } from './sidebar/ArchivePlanRow';

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
                    {/* Header Controls area with save button instead of big new plan */}
                    <div className="p-2 border-b border-glass-border" />

                    {/* タブ */}
                    <div className="px-3 pt-3">
                        <SegmentButton
                            options={[
                                { value: 'savage' as const, label: t('sidebar.tab_savage').toUpperCase() },
                                { value: 'ultimate' as const, label: t('sidebar.tab_ultimate').toUpperCase() },
                                { value: 'other' as const, label: t('sidebar.tab_other').toUpperCase() },
                                { value: 'archive' as const, label: t('sidebar.tab_archive').toUpperCase() },
                            ]}
                            value={activeTab}
                            onChange={setActiveTab}
                            size="sm"
                            className="shadow-sm"
                        />
                    </div>

                    {/* ボタンバー */}
                    <div className="px-3 shrink-0 my-2">
                        <div className="flex items-center gap-1 flex-wrap">
                        <button
                            onClick={() => {
                                setIsNewPlanModalOpen(true);
                                // create-plan チュートリアルトリガー（初回のみ）
                                const tutState = useTutorialStore.getState();
                                if (!tutState.completed['create-plan'] && !tutState.isActive) {
                                    tutState.startTutorial('create-plan');
                                }
                            }}
                            data-tutorial="new-plan-btn"
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-app-base font-black transition-all duration-300 border cursor-pointer bg-glass-card text-app-text border-glass-border hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text active:scale-95 shadow-sm"
                        >
                            <Plus size={12} />
                            {t('sidebar.new_plan').toUpperCase()}
                        </button>
                        <button
                            onClick={() => toggleMultiSelectMode('share')}
                            className={clsx(
                                "flex items-center gap-1 px-2 py-1 rounded-md text-app-base font-black transition-all duration-300 border cursor-pointer active:scale-95",
                                multiSelect.isEnabled && multiSelect.mode === 'share'
                                    ? "bg-app-toggle text-app-toggle-text border-app-toggle shadow-md"
                                    : "bg-glass-card text-app-text border-glass-border hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text shadow-sm"
                            )}
                        >
                            {multiSelect.isEnabled && multiSelect.mode === 'share' ? <CheckSquare size={12} /> : <Square size={12} />}
                            {t('sidebar.multi_select_mode').toUpperCase()}
                        </button>
                        {/* 選択削除ボタン — 押すと削除用選択モードに入る */}
                        <button
                            onClick={() => toggleMultiSelectMode('delete')}
                            className={clsx(
                                "flex items-center gap-1 px-2 py-1 rounded-md text-app-base font-black transition-all duration-300 border cursor-pointer active:scale-95 shadow-sm",
                                multiSelect.isEnabled && multiSelect.mode === 'delete'
                                    ? "bg-app-toggle text-app-toggle-text border-app-toggle shadow-md"
                                    : "bg-glass-card text-app-text border-glass-border hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text"
                            )}
                        >
                            <Trash2 size={12} />
                            {t('sidebar.select_delete').toUpperCase()}
                        </button>
                        {/* モバイルメニュー専用: 軽減自動組み立て(ボタンバー右の空きへ・短縮文言) */}
                        {fullWidth && (
                            <button
                                onClick={() => onAutoPlan?.()}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-app-base font-black transition-all duration-300 border cursor-pointer bg-glass-card text-app-text border-glass-border hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text active:scale-95 shadow-sm"
                            >
                                <Sparkles size={12} />
                                {t('mitigation.auto_plan_short').toUpperCase()}
                            </button>
                        )}
                        </div>
                    </div>

                    {/* 零式タブ (savage) */}
                    {activeTab === 'savage' && (
                        <div ref={savageListRef} className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
                            {(() => {
                                const savageContents = getSavageForCurrentExpansion();
                                const seriesIds = [...new Set(savageContents.map(c => c.seriesId))];
                                return seriesIds.map(sid => {
                                    const series = getSeriesById(sid);
                                    const contents = savageContents.filter(c => c.seriesId === sid);
                                    if (contents.length === 0) return null;
                                    const seriesName = series?.name[lang as ContentLanguage] || series?.name.ja || sid;
                                    const projectLabel = getProjectLabel(contents[0].level, 'savage');
                                    const sectionLabel = projectLabel
                                        ? `${projectLabel[lang as ContentLanguage] || projectLabel.ja}：${seriesName}`
                                        : seriesName;
                                    return (
                                        <div key={sid}>
                                            <div className="text-app-base font-bold text-app-text px-2.5 pt-3 pb-1">
                                                {sectionLabel}
                                            </div>
                                            {contents.map((content, idx) => (
                                                <ContentTreeItem
                                                    key={content.id}
                                                    content={content}
                                                    isActive={selectedContentId === content.id}
                                                    multiSelect={multiSelect}
                                                    onToggleSelect={toggleItemId}
                                                    onSelect={handleSelectContent}
                                                    highlightFirst={isTutorialContentSelect && idx === 0 && sid === seriesIds[0]}
                                                    lang={lang}
                                                    onContextMenu={(e, planId, planTitle, contentId) => {
                                                        setContextMenu({ x: e.clientX, y: e.clientY, planId, planTitle, contentId });
                                                    }}
                                                    onShiftSelect={(planId) => {
                                                        setMultiSelect(prev => ({
                                                            isEnabled: true,
                                                            selectedIds: prev.selectedIds.includes(planId)
                                                                ? prev.selectedIds.filter(id => id !== planId)
                                                                : [...prev.selectedIds, planId],
                                                            mode: prev.mode || 'share',
                                                        }));
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    )}

                    {/* 絶タブ (ultimate) */}
                    {activeTab === 'ultimate' && (
                        <div ref={ultimateListRef} className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
                            {getAllUltimates().map(content => (
                                <ContentTreeItem
                                    key={content.id}
                                    content={content}
                                    isActive={selectedContentId === content.id}
                                    multiSelect={multiSelect}
                                    onToggleSelect={toggleItemId}
                                    onSelect={handleSelectContent}
                                    lang={lang}
                                    showFullName
                                    onContextMenu={(e, planId, planTitle, contentId) => {
                                        setContextMenu({ x: e.clientX, y: e.clientY, planId, planTitle, contentId });
                                    }}
                                    onShiftSelect={(planId) => {
                                        setMultiSelect(prev => ({
                                            isEnabled: true,
                                            selectedIds: prev.selectedIds.includes(planId)
                                                ? prev.selectedIds.filter(id => id !== planId)
                                                : [...prev.selectedIds, planId],
                                            mode: prev.mode || 'share',
                                        }));
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    {/* その他タブ (other) */}
                    {activeTab === 'other' && (
                        <div ref={otherListRef} className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
                            {getOtherContents().map(content => (
                                <ContentTreeItem
                                    key={content.id}
                                    content={content}
                                    isActive={selectedContentId === content.id}
                                    multiSelect={multiSelect}
                                    onToggleSelect={toggleItemId}
                                    onSelect={handleSelectContent}
                                    lang={lang}
                                    onContextMenu={(e, planId, planTitle, contentId) => {
                                        setContextMenu({ x: e.clientX, y: e.clientY, planId, planTitle, contentId });
                                    }}
                                    onShiftSelect={(planId) => {
                                        setMultiSelect(prev => ({
                                            isEnabled: true,
                                            selectedIds: prev.selectedIds.includes(planId)
                                                ? prev.selectedIds.filter(id => id !== planId)
                                                : [...prev.selectedIds, planId],
                                            mode: prev.mode || 'share',
                                        }));
                                    }}
                                />
                            ))}
                            {(['dungeon', 'raid', 'custom'] as const).map(cat => {
                                const catPlans = plans.filter(p => {
                                    if (p.archived) return false;
                                    if (p.category) return p.category === cat;
                                    if (p.contentId === null && cat === 'custom') return true;
                                    if (p.contentId && !getContentById(p.contentId) && cat === 'custom') return true;
                                    return false;
                                });
                                if (catPlans.length === 0) return null;
                                const catLabel = CATEGORY_LABELS[cat][lang as ContentLanguage] || CATEGORY_LABELS[cat].ja;
                                return (
                                    <FreePlanSection
                                        key={cat}
                                        label={catLabel}
                                        plans={catPlans}
                                        currentPlanId={currentPlanId}
                                        multiSelect={multiSelect}
                                        onToggleSelect={toggleItemId}
                                        onLoadPlan={handleLoadPlan}
                                        onUpdatePlan={updatePlan}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {/* アーカイブタブ (archive) */}
                    {activeTab === 'archive' && (
                        <div ref={archiveListRef} className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
                            {(() => {
                                const archivedPlans = plans.filter(p => p.archived);
                                if (archivedPlans.length === 0) {
                                    return (
                                        <div className="text-center text-app-text-muted text-app-base py-8">
                                            {t('sidebar.archive_empty')}
                                        </div>
                                    );
                                }
                                const sorted = [...archivedPlans].sort((a, b) => {
                                    const levelA = a.level ?? 0;
                                    const levelB = b.level ?? 0;
                                    if (levelA !== levelB) return levelA - levelB;
                                    const catOrder = ['savage', 'ultimate', 'dungeon', 'raid', 'custom'];
                                    return catOrder.indexOf(a.category || 'custom') - catOrder.indexOf(b.category || 'custom');
                                });
                                return sorted.map(plan => (
                                    <ArchivePlanRow
                                        key={plan.id}
                                        plan={plan}
                                        currentPlanId={currentPlanId}
                                        runTransition={runTransition}
                                        t={t}
                                    />
                                ));
                            })()}
                        </div>
                    )}

                    {/* フローティングアクションバー — 画面下部中央（createPortalでbody直下） */}
                    {createPortal(
                        <div className={clsx(
                            "fixed bottom-6 left-1/2 z-[99980] flex items-center gap-3 px-5 py-2.5",
                            "bg-app-bg border border-app-text/15 rounded-2xl",
                            "shadow-[0_8px_32px_rgba(0,0,0,.6)]",
                            "transition-all duration-300",
                            multiSelect.isEnabled && !bundleModalOpen
                                ? "opacity-100 translate-x-[-50%] translate-y-0 pointer-events-auto"
                                : "opacity-0 translate-x-[-50%] translate-y-10 pointer-events-none"
                        )}
                            ref={floatingBarRef}
                        >
                            {/* 選択件数 */}
                            <span className={clsx(
                                "text-app-md font-black text-app-text whitespace-nowrap min-w-[72px] text-center",
                                floatingBarFlash && "animate-[floatingCountBounce_.3s_cubic-bezier(.34,1.56,.64,1)]"
                            )}
                                key={multiSelect.selectedIds.length}
                            >
                                {multiSelect.mode === 'delete'
                                    ? t('sidebar.selected_count_simple', { count: multiSelect.selectedIds.length })
                                    : t('sidebar.selected_count', { count: multiSelect.selectedIds.length })
                                }
                            </span>
                            <div className="w-px h-5 bg-app-text/10 shrink-0" />
                            {/* キャンセル */}
                            <button
                                onClick={() => setMultiSelect({ isEnabled: false, selectedIds: [], mode: 'share' })}
                                className="py-1.5 px-4 rounded-lg text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                            >
                                {t('sidebar.cancel')}
                            </button>
                            {/* アクションボタン */}
                            {multiSelect.mode === 'share' ? (
                                <button
                                    onClick={handleShareBundle}
                                    disabled={multiSelect.selectedIds.length === 0}
                                    className={clsx(
                                        "flex items-center gap-2 py-1.5 px-4 rounded-lg text-app-md font-black transition-all cursor-pointer whitespace-nowrap",
                                        multiSelect.selectedIds.length > 0
                                            ? "bg-app-blue text-white hover:bg-app-blue-hover active:scale-95"
                                            : "bg-app-blue-dim text-app-text-muted opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <Share2 size={13} />
                                    <span>{t('sidebar.share_together')}</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (multiSelect.selectedIds.length === 0) return;
                                        setShowDeleteConfirm(true);
                                    }}
                                    disabled={multiSelect.selectedIds.length === 0}
                                    className={clsx(
                                        "flex items-center gap-2 py-1.5 px-4 rounded-lg text-app-md font-black transition-all cursor-pointer whitespace-nowrap",
                                        multiSelect.selectedIds.length > 0
                                            ? "bg-app-red text-white hover:bg-app-red-hover active:scale-95"
                                            : "bg-app-red-dim text-app-text-muted opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <Trash2 size={13} />
                                    <span>{t('sidebar.delete')}</span>
                                </button>
                            )}
                        </div>,
                        document.body
                    )}

                    {/* 運営からの通知 Bar (未読 0 で枠ごと消える) */}
                    {!multiSelect.isEnabled && (
                        <div className="shrink-0">
                            <SystemNotificationBar isCollapsed={!isOpen} />
                        </div>
                    )}

                    {/* ローカル保存のみユーザーへの安全性案内 (非ログイン且つ表あり時のみ) */}
                    {!multiSelect.isEnabled && (
                        <div className="shrink-0">
                            <LocalDataSafetyBar
                                isCollapsed={!isOpen}
                                onOpenBackup={() => setBackupExportOpen(true)}
                            />
                        </div>
                    )}

                    {/* バックアップ/復元ボタン
                        サイドバー最下部になるので、下に余白を取る。 */}
                    {!multiSelect.isEnabled && (
                        <div className={'shrink-0 px-3 pt-1 pb-3'}>
                            <div className="border-t border-glass-border w-full mb-1" />
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setBackupExportOpen(true)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-app-sm text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
                                >
                                    <HardDrive size={11} />
                                    {isOpen ? t('backup.backup_button') : null}
                                </button>
                                <button
                                    onClick={() => setBackupRestoreOpen(true)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-app-sm text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
                                >
                                    <Download size={11} />
                                    {isOpen ? t('backup.restore_button') : null}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* [2] ── 常設ハンドル領域 ── */}
            {fullWidth ? null : <div
                className="h-full w-6 z-50 flex items-center justify-center shrink-0 relative"
            >
                {/* 折りたたみ時のみ: 未読通知ベルをハンドル上部に重ねる (未読が無ければ何も出ない) */}
                {!isOpen && <SystemNotificationHandleButton />}

                {/* 折りたたみ時のみ: ローカルデータ安全性アイコン (要確認の赤バッジがある時のみ) */}
                {!isOpen && <LocalDataSafetyHandleButton onOpenBackup={() => setBackupExportOpen(true)} />}

                {/* 固定ライン — チュートリアル中もハンドルが非表示でも常に表示 */}
                {tutorialActive && currentStepIndex <= 2 && (<>
                    <div className="absolute inset-y-0 left-0 w-[1px] bg-app-border z-50" />
                    <div className="absolute inset-y-0 right-0 w-[1px] bg-app-border z-50" />
                </>)}

                <div
                    className={clsx(
                        "absolute left-0 h-full w-6 bg-glass-header z-50",
                        tutorialActive && currentStepIndex <= 2 ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
                >
                    <Tooltip content={isOpen ? t('sidebar.close_menu') : t('sidebar.open_menu')} position="right" wrapperClassName="w-full h-full">
                        <button
                            onClick={() => onToggle?.()}
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                            className={clsx(
                                "relative w-full h-full cursor-pointer overflow-hidden group/btn outline-none",
                                "hover:bg-app-surface2 active:bg-app-surface2 transition-colors duration-200"
                            )}
                        >
                            {/* 左端の固定ライン（右端はサイドバーのglass-tier3 borderが担当） */}
                            <div className="absolute inset-y-0 left-0 w-[1px] bg-app-border group-hover/btn:bg-app-text-muted transition-colors duration-200" />

                            <div className="relative flex items-center justify-center h-full">
                                <motion.div
                                    className="flex items-center justify-center"
                                    animate={{
                                        rotate: isOpen ? 0 : 180,
                                        x: isHovered ? (isOpen ? [-2, 2, -2] : [2, -2, 2]) : 0,
                                        scale: isHovered ? 1.8 : 1
                                    }}
                                    transition={{
                                        rotate: { type: "spring", stiffness: 260, damping: 20 },
                                        x: isHovered ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" } : { duration: 0.2 },
                                        scale: { duration: 0.2 }
                                    }}
                                >
                                    <ChevronLeft
                                        size={18}
                                        className={clsx(
                                            "transition-all duration-200",
                                            "text-app-text-muted group-hover/btn:text-app-text-sec",
                                            isHovered && "text-app-text-sec"
                                        )}
                                    />
                                </motion.div>
                            </div>

                            {/* 右端の境界線 */}
                            <div className={clsx(
                                "absolute right-0 top-0 bottom-0 w-[1px] transition-all duration-200",
                                isOpen ? "bg-glass-border" : "bg-app-border",
                                "group-hover/btn:bg-app-text-muted"
                            )} />
                        </button>
                    </Tooltip>
                </div>
            </div>}
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
                        className="relative bg-app-bg border border-app-border rounded-2xl shadow-2xl w-[360px] max-w-[90vw] overflow-hidden"
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
                        className="relative w-full max-w-[400px] glass-tier3 rounded-2xl overflow-hidden"
                        style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
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
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    items={[
                        {
                            label: t('sidebar.context_share'),
                            icon: <Share2 size={12} />,
                            onClick: async () => {
                                const plan = plans.find(p => p.id === contextMenu.planId);
                                if (plan) {
                                    let planData = plan.data;
                                    if ((!planData || Object.keys(planData).length === 0) && plan.compressedData) {
                                        try {
                                            planData = await decompressPlanData(plan.compressedData);
                                        } catch {
                                            showToast(t('app.decompress_error') || 'データの読み込みに失敗しました。ページを更新してください。ログインしていない場合、データが復元できないことがあります。', 'error');
                                            return;
                                        }
                                    }
                                    setBundlePlansForModal([{
                                        contentId: plan.contentId,
                                        title: plan.title,
                                        planData,
                                    }]);
                                    setBundleModalOpen(true);
                                }
                            },
                        },
                        {
                            label: t('sidebar.context_duplicate'),
                            icon: <Copy size={12} />,
                            onClick: async () => {
                                const newPlan = await usePlanStore.getState().duplicatePlan(contextMenu.planId);
                                if (!newPlan) showToast(t('sidebar.duplicate_limit_reached'), 'error');
                            },
                        },
                        {
                            label: t('sidebar.context_rename'),
                            icon: <Pencil size={12} />,
                            onClick: () => {
                                window.dispatchEvent(new CustomEvent('sidebar:start-rename', {
                                    detail: { planId: contextMenu.planId },
                                }));
                            },
                        },
                        { divider: true, label: '', onClick: () => {} },
                        {
                            label: t('sidebar.context_delete'),
                            icon: <Trash2 size={12} />,
                            danger: true,
                            onClick: () => {
                                const ps = usePlanStore.getState();
                                const authUser = useAuthStore.getState().user;
                                if (authUser) {
                                    ps.deleteFromFirestore(contextMenu.planId, authUser.uid, contextMenu.contentId);
                                } else {
                                    ps.deletePlan(contextMenu.planId);
                                }
                            },
                        },
                    ]}
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
