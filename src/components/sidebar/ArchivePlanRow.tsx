import React from 'react';
import { useMitigationStore } from '../../store/useMitigationStore';
import { Tooltip } from '../ui/Tooltip';
import { usePlanStore } from '../../store/usePlanStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { setLastOpened } from '../../utils/lastOpenedStore';

// ─────────────────────────────────────────────
// Sub-component: ArchivePlanRow
// アーカイブタブのプラン行（2段階確認付き削除）
// ─────────────────────────────────────────────

interface ArchivePlanRowProps {
    plan: import('../../types').SavedPlan;
    currentPlanId: string | null;
    runTransition: (fn: () => void | Promise<void>, variant?: 'theme' | 'language' | 'plan' | 'default') => void;
    t: (key: string, opts?: Record<string, unknown>) => string;
}

export const ArchivePlanRow: React.FC<ArchivePlanRowProps> = ({ plan, currentPlanId, runTransition, t }) => {
    const [confirmDelete, setConfirmDelete] = React.useState(false);

    return (
        <div
            role="button"
            tabIndex={0}
            className={clsx(
                "sidebar-item flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-app-base text-app-text hover:bg-glass-hover cursor-pointer transition-colors active:scale-[0.98] group/plan",
                currentPlanId === plan.id && "bg-app-text/10 font-bold"
            )}
            onClick={async () => {
                const data = await usePlanStore.getState().decompressArchivedPlan(plan.id);
                if (data) {
                    runTransition(() => {
                        const store = usePlanStore.getState();
                        const snap = useMitigationStore.getState().getSnapshot();
                        if (store.currentPlanId) {
                            store.updatePlan(store.currentPlanId, { data: snap });
                        }
                        store.updatePlan(plan.id, { data });
                        useMitigationStore.getState().loadSnapshot(data, plan.id);
                        store.setCurrentPlanId(plan.id);
                        // lastOpenedAt を更新
                        setLastOpened(plan.id, Date.now());
                    }, 'plan');
                }
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).click();
                }
            }}
        >
            <span className={clsx("w-1 h-1 rounded-full shrink-0", currentPlanId === plan.id ? "bg-app-toggle" : "bg-app-text-muted/40")} />
            <span className="truncate flex-1">{plan.title}</span>
            <span className="text-app-sm text-app-text-muted shrink-0 mr-1">
                Lv{plan.level}
            </span>
            {/* 削除ボタン（2段階確認） */}
            <div className={clsx(
                "flex items-center shrink-0 transition-opacity duration-150",
                currentPlanId === plan.id ? "opacity-100" : "opacity-0 group-hover/plan:opacity-100"
            )}>
                <Tooltip content={confirmDelete ? t('sidebar.delete_single_confirm_click') : t('sidebar.delete_single')}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirmDelete) {
                                const ps = usePlanStore.getState();
                                const authUser = useAuthStore.getState().user;
                                if (authUser) {
                                    ps.deleteFromFirestore(plan.id, authUser.uid, plan.contentId);
                                } else {
                                    ps.deletePlan(plan.id);
                                }
                                setConfirmDelete(false);
                            } else {
                                setConfirmDelete(true);
                                setTimeout(() => setConfirmDelete(false), 3000);
                            }
                        }}
                        className={clsx(
                            "shrink-0 rounded flex items-center justify-center transition-colors cursor-pointer",
                            confirmDelete
                                ? "text-app-red bg-app-red-dim px-2 py-0.5 gap-1"
                                : "text-app-text-muted hover:text-app-red-hover hover:bg-app-red-dim w-5 h-5"
                        )}
                    >
                        <Trash2 size={9} />
                        {confirmDelete && (
                            <span className="text-app-base font-bold whitespace-nowrap">{t('sidebar.delete_single')}</span>
                        )}
                    </button>
                </Tooltip>
            </div>
        </div>
    );
};
