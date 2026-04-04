import React from 'react';
import { CloudCheck, CloudUpload, CloudAlert } from 'lucide-react';
import clsx from 'clsx';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';

/**
 * クラウド同期アイコンボタン
 * - CloudCheck: 同期済み（青）
 * - CloudUpload: 同期中（回転）
 * - CloudAlert: エラー（赤）
 * - タップで即時同期（クールダウン無視）
 * - 未ログイン or プラン未選択時は非表示
 */
export const SyncButton: React.FC<{ size?: number; className?: string }> = React.memo(({ size = 16, className }) => {
    const currentPlanId = usePlanStore(s => s.currentPlanId);
    const cloudStatus = usePlanStore(s => s._cloudStatus);
    const user = useAuthStore(s => s.user);
    const profileDisplayName = useAuthStore(s => s.profileDisplayName);

    if (!currentPlanId || !user) return null;

    const handleSync = () => {
        const planStore = usePlanStore.getState();
        if (planStore.currentPlanId) {
            const snapshot = useMitigationStore.getState().getSnapshot();
            planStore.updatePlan(planStore.currentPlanId, { data: snapshot });
        }
        planStore.manualSync(
            user.uid,
            profileDisplayName || 'User',
        );
    };

    let Icon = CloudCheck;
    let iconClass = 'text-blue-400';
    let animate = '';

    if (cloudStatus === 'syncing') {
        Icon = CloudUpload;
        iconClass = 'text-app-text/40';
        animate = 'animate-spin';
    } else if (cloudStatus === 'error') {
        Icon = CloudAlert;
        iconClass = 'text-red-400';
    }

    return (
        <button
            onClick={handleSync}
            disabled={cloudStatus === 'syncing'}
            className={clsx(
                "flex items-center justify-center rounded transition-all duration-200 hover:bg-app-text/10 active:scale-90 disabled:pointer-events-none",
                iconClass,
                className,
            )}
            style={{ flexShrink: 0 }}
        >
            <Icon size={size} className={animate} />
        </button>
    );
});
SyncButton.displayName = 'SyncButton';
