import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePlanMultiSelect } from '../../hooks/usePlanMultiSelect';
import { usePlanStore } from '../../store/usePlanStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Share2, Trash2, Pencil, Copy } from 'lucide-react';
import { showToast } from '../Toast';
import { ContextMenu } from '../ui/ContextMenu';
import { decompressPlanData } from '../../utils/compression';
import type { SavedPlan } from '../../types';
import type { useSidebarNav } from './useSidebarNav';

type Nav = ReturnType<typeof useSidebarNav>;

interface SidebarContextMenuProps {
    contextMenu: NonNullable<Nav['contextMenu']>;
    setContextMenu: Nav['setContextMenu'];
    plans: SavedPlan[];
    setBundleModalOpen: (open: boolean) => void;
    setBundlePlansForModal: ReturnType<typeof usePlanMultiSelect>['setBundlePlans'];
}

export const SidebarContextMenu: React.FC<SidebarContextMenuProps> = ({ contextMenu, setContextMenu, plans, setBundleModalOpen, setBundlePlansForModal }) => {
    const { t } = useTranslation();
    return (
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
    );
};
