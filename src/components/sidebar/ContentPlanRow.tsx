import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../../store/useMitigationStore';
import type { SavedPlan } from '../../types';
import { Tooltip } from '../ui/Tooltip';
import type { MultiSelectState } from '../../types/sidebarTypes';
import { usePlanStore } from '../../store/usePlanStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { TransitionContextValue } from '../ui/transitionOverlayContext';
import { CheckSquare, Square, Trash2, Pencil, Copy, Users } from 'lucide-react';
import clsx from 'clsx';
import { showToast } from '../toastBus';
import { loadPlanDataIntoStore } from '../../lib/planLoad';
import { setLastOpened } from '../../utils/lastOpenedStore';

interface ContentPlanRowProps {
    plan: SavedPlan;
    multiSelect: MultiSelectState;
    onToggleSelect: (id: string) => void;
    onContextMenu?: (e: React.MouseEvent, planId: string, planTitle: string, contentId: string | null) => void;
    onShiftSelect?: (planId: string) => void;
    currentPlanId: string | null;
    runTransition: TransitionContextValue['runTransition'];
    editingPlanId: string | null;
    setEditingPlanId: React.Dispatch<React.SetStateAction<string | null>>;
    editingTitle: string;
    setEditingTitle: React.Dispatch<React.SetStateAction<string>>;
    editInputRef: React.RefObject<HTMLInputElement | null>;
    finishEditing: () => void;
    startEditing: (planId: string, title: string, e: React.MouseEvent) => void;
    confirmDeletePlanId: string | null;
    setConfirmDeletePlanId: React.Dispatch<React.SetStateAction<string | null>>;
}

/** コンテンツの下に並ぶ保存済みプラン 1 行(通常 / 複数選択 / 名前編集の 3 表示) */
export const ContentPlanRow: React.FC<ContentPlanRowProps> = ({
    plan, multiSelect, onToggleSelect, onContextMenu, onShiftSelect, currentPlanId, runTransition,
    editingPlanId, setEditingPlanId, editingTitle, setEditingTitle, editInputRef, finishEditing, startEditing,
    confirmDeletePlanId, setConfirmDeletePlanId,
}) => {
    const { t } = useTranslation();
        const isPlanSelected = multiSelect.selectedIds.includes(plan.id);
        const isPlanDisabled = multiSelect.isEnabled && multiSelect.mode === 'share' && !isPlanSelected && multiSelect.selectedIds.length >= 10;


    return (
            <div className="flex items-center gap-1 w-full">
                {multiSelect.isEnabled ? (
                    // 複数選択モード: チェックボックス付きプラン行
                    <button
                        onClick={() => { if (!isPlanDisabled) onToggleSelect(plan.id); }}
                        disabled={isPlanDisabled}
                        className={clsx(
                            "sidebar-item flex-1 text-left text-app-base py-1 px-2 rounded-md transition-colors font-medium truncate flex items-center gap-2 cursor-pointer active:scale-[0.98]",
                            isPlanSelected
                                ? "bg-app-text/10 text-app-text font-bold"
                                : "text-app-text hover:bg-glass-hover",
                            isPlanDisabled && "opacity-40 cursor-not-allowed"
                        )}
                    >
                        {isPlanSelected
                            ? <CheckSquare size={12} className="text-app-text shrink-0" />
                            : <Square size={12} className="text-app-text-muted/40 shrink-0" />
                        }
                        {plan.title}
                    </button>
                ) : editingPlanId === plan.id ? (
                    <input
                        ref={editInputRef}
                        autoFocus
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onBlur={finishEditing}
                        onKeyDown={e => { if (e.key === 'Enter') finishEditing(); if (e.key === 'Escape') setEditingPlanId(null); }}
                        className="flex-1 text-[16px] md:text-app-base py-1 px-2 rounded-md bg-app-bg border border-app-text/30 text-app-text font-medium outline-none"
                    />
                ) : (
                    <div
                        role="button"
                        tabIndex={0}
                        className={clsx(
                            "sidebar-item flex-1 min-w-0 text-left text-app-base py-1 px-2 rounded-md transition-colors font-medium flex items-center gap-2 cursor-pointer active:scale-[0.98] group/plan",
                            currentPlanId === plan.id
                                ? "bg-app-text/10 text-app-text font-bold"
                                : "text-app-text hover:bg-glass-hover",
                            "relative"
                        )}
                        onClick={(e) => {
                            // Shift+クリック → 複数選択モードに入りつつ選択
                            if (e.shiftKey) {
                                onShiftSelect?.(plan.id);
                                return;
                            }
                            if (currentPlanId === plan.id) return;
                            runTransition(async () => {
                                const store = usePlanStore.getState();
                                const snap = useMitigationStore.getState().getSnapshot();
                                if (store.currentPlanId) {
                                    store.updatePlan(store.currentPlanId, { data: snap });
                                    // アーカイブ/サイレント圧縮プランなら再圧縮
                                    const currentPlan = store.plans.find(p => p.id === store.currentPlanId);
                                    if (currentPlan?.archived || currentPlan?.compressedData) {
                                        store.archivePlan(store.currentPlanId);
                                    }
                                }
                                // 共有ヘルパで読込(圧縮なら解凍)。解凍時は書き戻して再キャッシュ。
                                try {
                                    const loaded = await loadPlanDataIntoStore(plan);
                                    if (loaded && plan.compressedData) {
                                        store.updatePlan(plan.id, { data: loaded, compressedData: undefined });
                                    }
                                } catch {
                                    showToast(t('app.decompress_error') || 'データの読み込みに失敗しました。ページを更新してください。ログインしていない場合、データが復元できないことがあります。', 'error');
                                    return;
                                }
                                store.setCurrentPlanId(plan.id);
                                // lastOpenedAt を更新
                                setLastOpened(plan.id, Date.now());
                            }, 'plan');
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.currentTarget.click();
                            }
                        }}
                        onContextMenu={(e) => {
                            // 複数選択モード中はコンテキストメニューを表示しない
                            if (multiSelect.isEnabled) return;
                            e.preventDefault();
                            onContextMenu?.(e, plan.id, plan.title, plan.contentId);
                        }}
                    >
                        {currentPlanId === plan.id && (
                            <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-app-toggle" />
                        )}
                        <span className={clsx("w-1 h-1 rounded-full shrink-0", currentPlanId === plan.id ? "bg-app-toggle" : "bg-app-text-muted/40")} />
                        <Tooltip content={plan.title} position="top" wrapperClassName="flex-1 min-w-0 !w-auto !justify-start">
                            <span className="block truncate text-left">{plan.title}</span>
                        </Tooltip>
                        {/* 共同編集 ON バッジ (常時表示・白黒トーン・Google Drive 人型標準) */}
                        {plan.activeCollabRoomToken && (
                            <Tooltip content={t('collab.badge_on')} position="top">
                                <Users
                                    size={13}
                                    className={clsx(
                                        "shrink-0",
                                        currentPlanId === plan.id ? "text-app-text" : "text-app-text-muted"
                                    )}
                                />
                            </Tooltip>
                        )}
                        <div className={clsx(
                            "flex items-center shrink-0 transition-opacity duration-150",
                            currentPlanId === plan.id
                                ? "opacity-100"
                                : "opacity-0 group-hover/plan:opacity-100"
                        )}>
                            <Tooltip content={t('sidebar.duplicate_plan')}>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        const newPlan = await usePlanStore.getState().duplicatePlan(plan.id);
                                        if (!newPlan) {
                                            showToast(t('sidebar.duplicate_limit_reached'), 'error');
                                        }
                                    }}
                                    className="ml-auto shrink-0 w-5 h-5 rounded flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
                                >
                                    <Copy size={9} />
                                </button>
                            </Tooltip>
                            <Tooltip content={t('app.rename')}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); startEditing(plan.id, plan.title, e); }}
                                    className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
                                >
                                    <Pencil size={9} />
                                </button>
                            </Tooltip>
                            {/* 削除ボタン（2段階確認） */}
                            <Tooltip content={confirmDeletePlanId === plan.id ? t('sidebar.delete_single_confirm_click') : t('sidebar.delete_single')}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirmDeletePlanId === plan.id) {
                                        const ps = usePlanStore.getState();
                                        const authUser = useAuthStore.getState().user;
                                        if (authUser) {
                                            ps.deleteFromFirestore(plan.id, authUser.uid, plan.contentId);
                                        } else {
                                            ps.deletePlan(plan.id);
                                        }
                                        setConfirmDeletePlanId(null);
                                    } else {
                                        setConfirmDeletePlanId(plan.id);
                                        setTimeout(() => setConfirmDeletePlanId(null), 3000);
                                    }
                                }}
                                className={clsx(
                                    "shrink-0 rounded flex items-center justify-center transition-colors cursor-pointer",
                                    confirmDeletePlanId === plan.id
                                        ? "text-app-red bg-app-red-dim px-2 py-0.5 gap-1"
                                        : "text-app-text-muted hover:text-app-red-hover hover:bg-app-red-dim w-5 h-5"
                                )}
                            >
                                <Trash2 size={9} />
                                {confirmDeletePlanId === plan.id && (
                                    <span className="text-app-base font-bold whitespace-nowrap">{t('sidebar.delete_single')}</span>
                                )}
                            </button>
                            </Tooltip>
                        </div>
                    </div>
                )}
            </div>
    );
};
