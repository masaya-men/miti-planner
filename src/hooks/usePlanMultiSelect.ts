import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { showToast } from '../components/toastBus';
import { decompressPlanData } from '../utils/compression';
import type { MultiSelectState } from '../types/sidebarTypes';

/** 共有モードで同時に選べる最大件数 */
export const MULTI_SHARE_LIMIT = 10;

type BundlePlan = { contentId: string | null; title: string; planData: unknown };

/**
 * 複数選択(まとめて共有・選択削除)の state と処理。
 * 標準 Sidebar から手順を変えずに切り出したもの。
 */
export function usePlanMultiSelect() {
    const { t } = useTranslation();

    const [multiSelect, setMultiSelect] = useState<MultiSelectState>({
        isEnabled: false,
        selectedIds: [],
        mode: 'share',
    });

    // まとめて共有（バンドル） → モーダル経由
    const [bundleOpen, setBundleOpen] = useState(false);
    const [bundlePlans, setBundlePlans] = useState<BundlePlan[]>([]);

    const toggleMode = (mode: 'share' | 'delete' = 'share') => {
        setMultiSelect(prev => {
            if (prev.isEnabled && prev.mode === mode) {
                // 同じモードを再度押した → オフにする
                return { isEnabled: false, selectedIds: [], mode: 'share' };
            }
            // オフ→オン or 別モードに切り替え
            return { isEnabled: true, selectedIds: [], mode };
        });
    };

    const toggleId = (id: string) => {
        setMultiSelect(prev => {
            const isSelected = prev.selectedIds.includes(id);
            if (isSelected) {
                return { ...prev, selectedIds: prev.selectedIds.filter(i => i !== id) };
            } else if (prev.mode === 'delete' || prev.selectedIds.length < MULTI_SHARE_LIMIT) {
                return { ...prev, selectedIds: [...prev.selectedIds, id] };
            }
            return prev;
        });
    };

    // setState のみに依存するので参照は不変(Escape の購読などが張り直されない)
    const reset = useCallback(() => {
        setMultiSelect({ isEnabled: false, selectedIds: [], mode: 'share' });
    }, []);

    const openBundleShare = async () => {
        if (multiSelect.selectedIds.length === 0) return;

        // 現在のプランを保存
        const planStore = usePlanStore.getState();
        const mitiStore = useMitigationStore.getState();
        const currentPlanId = planStore.currentPlanId;
        if (currentPlanId) {
            planStore.updatePlan(currentPlanId, { data: mitiStore.getSnapshot() });
        }

        // 選択されたプランIDからデータを収集（圧縮済みプランは解凍）
        const bundlePlansRaw = await Promise.all(
            multiSelect.selectedIds.map(async (planId) => {
                const plan = planStore.plans.find(p => p.id === planId);
                if (!plan) return null;
                let planData = plan.data;
                if ((!planData || Object.keys(planData).length === 0) && plan.compressedData) {
                    try {
                        planData = await decompressPlanData(plan.compressedData);
                    } catch {
                        return null;
                    }
                }
                return {
                    contentId: plan.contentId,
                    title: plan.title,
                    planData,
                };
            })
        );
        const collected = bundlePlansRaw.filter(Boolean) as BundlePlan[];

        if (collected.length === 0) {
            showToast(t('app.share_no_plans') || 'プランがありません');
            return;
        }

        setBundlePlans(collected);
        setBundleOpen(true);
    };

    // モーダルを閉じて選択を解除(元の ShareModal onClose と同じ: mode は付けない)
    const closeBundleShare = () => {
        setBundleOpen(false);
        setMultiSelect({ isEnabled: false, selectedIds: [] });
    };

    const deleteSelected = async () => {
        const planStore = usePlanStore.getState();
        const authUser = useAuthStore.getState().user;
        for (const id of multiSelect.selectedIds) {
            const plan = planStore.plans.find(p => p.id === id);
            if (authUser) {
                // ログイン中: Firestoreから即時削除
                planStore.deleteFromFirestore(id, authUser.uid, plan?.contentId || null);
            } else {
                planStore.deletePlan(id);
            }
        }
        reset();
    };

    return {
        multiSelect,
        setMultiSelect,
        toggleMode,
        toggleId,
        reset,
        bundleOpen,
        bundlePlans,
        // 単体共有(右クリックメニュー)が同じモーダルを使うため公開する
        setBundleOpen,
        setBundlePlans,
        openBundleShare,
        closeBundleShare,
        deleteSelected,
    };
}
