import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../ui/Tooltip';
import type { MultiSelectState } from '../../types/sidebarTypes';
import { usePlanStore } from '../../store/usePlanStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CheckSquare, Square, Trash2, Pencil, Copy } from 'lucide-react';
import clsx from 'clsx';
import { showToast } from '../Toast';

// ─────────────────────────────────────────────
// Sub-component: FreePlanSection
// ダンジョン・レイド・その他のフリープラン表示
// ─────────────────────────────────────────────

interface FreePlanSectionProps {
    label: string;
    plans: import('../../types').SavedPlan[];
    currentPlanId: string | null;
    multiSelect: MultiSelectState;
    onToggleSelect: (id: string) => void;
    onLoadPlan: (id: string) => void;
    onUpdatePlan: (id: string, data: Partial<import('../../types').SavedPlan>) => void;
}

export const FreePlanSection: React.FC<FreePlanSectionProps> = ({
    label, plans: catPlans, currentPlanId, multiSelect, onToggleSelect, onLoadPlan, onUpdatePlan
}) => {
    const { t } = useTranslation();
    const [editingPlanId, setEditingPlanId] = React.useState<string | null>(null);
    const [editingTitle, setEditingTitle] = React.useState('');
    const editInputRef = React.useRef<HTMLInputElement>(null);
    const [confirmDeletePlanId, setConfirmDeletePlanId] = React.useState<string | null>(null);

    const startEditing = (planId: string, title: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingPlanId(planId);
        setEditingTitle(title);
        setTimeout(() => editInputRef.current?.select(), 0);
    };
    const finishEditing = () => {
        if (editingPlanId && editingTitle.trim()) {
            onUpdatePlan(editingPlanId, { title: editingTitle.trim() });
        }
        setEditingPlanId(null);
    };

    return (
        <div className="mb-2 mt-2">
            <div className="px-2 py-1.5">
                <span className="font-bold text-app-base tracking-widest uppercase text-app-text-muted">
                    {label}
                </span>
            </div>
            <div className="ml-3 mt-1 space-y-0.5 border-l border-glass-border pl-2">
                {catPlans.map(plan => {
                    const isPlanSelected = multiSelect.isEnabled && multiSelect.selectedIds.includes(plan.id);
                    const isPlanDisabled = multiSelect.isEnabled && multiSelect.mode === 'share' && !isPlanSelected && multiSelect.selectedIds.length >= 10;

                    if (multiSelect.isEnabled) {
                        return (
                            <button
                                key={plan.id}
                                onClick={() => { if (!isPlanDisabled) onToggleSelect(plan.id); }}
                                disabled={isPlanDisabled}
                                className={clsx(
                                    "sidebar-item w-full text-left text-app-base py-1 px-2 rounded-md transition-colors font-medium truncate flex items-center gap-2 cursor-pointer active:scale-[0.98]",
                                    isPlanSelected ? "bg-app-text/10 text-app-text font-bold" : "text-app-text hover:bg-glass-hover",
                                    isPlanDisabled && "opacity-40 cursor-not-allowed"
                                )}
                            >
                                {isPlanSelected
                                    ? <CheckSquare size={12} className="text-app-text shrink-0" />
                                    : <Square size={12} className="text-app-text-muted/40 shrink-0" />}
                                {plan.title}
                            </button>
                        );
                    }

                    if (editingPlanId === plan.id) {
                        return (
                            <input
                                key={plan.id}
                                ref={editInputRef}
                                autoFocus
                                value={editingTitle}
                                onChange={e => setEditingTitle(e.target.value)}
                                onBlur={finishEditing}
                                onKeyDown={e => { if (e.key === 'Enter') finishEditing(); if (e.key === 'Escape') setEditingPlanId(null); }}
                                className="flex-1 text-[16px] md:text-app-base py-1 px-2 rounded-md bg-app-bg border border-app-text/30 text-app-text font-medium outline-none w-full"
                            />
                        );
                    }

                    return (
                        <div
                            key={plan.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onLoadPlan(plan.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onLoadPlan(plan.id);
                                }
                            }}
                            className={clsx(
                                "sidebar-item w-full text-left text-app-base py-1 px-2 rounded-md transition-colors font-medium flex items-center gap-2 cursor-pointer active:scale-[0.98] relative group/plan",
                                currentPlanId === plan.id
                                    ? "bg-app-text/10 text-app-text font-bold"
                                    : "text-app-text hover:bg-glass-hover"
                            )}
                        >
                            {currentPlanId === plan.id && (
                                <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-app-toggle" />
                            )}
                            <span className={clsx("w-1 h-1 rounded-full shrink-0", currentPlanId === plan.id ? "bg-app-toggle" : "bg-app-text-muted/40")} />
                            <Tooltip content={plan.title} position="top" wrapperClassName="flex-1 min-w-0 !w-auto !justify-start">
                                <span className="block truncate text-left">{plan.title}</span>
                            </Tooltip>
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
                                        className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
                                    >
                                        <Copy size={9} />
                                    </button>
                                </Tooltip>
                                <Tooltip content={t('app.rename')}>
                                    <button
                                        onClick={(e) => startEditing(plan.id, plan.title, e)}
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
                    );
                })}
            </div>
        </div>
    );
};
