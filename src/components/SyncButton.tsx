import React from 'react';
import { CloudCheck, CloudUpload, CloudAlert, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { showToast } from './Toast';

/**
 * クラウド同期アイコンボタン
 * - CloudCheck: 同期済み（青）
 * - CloudUpload: 同期中（回転）
 * - CloudAlert: エラー（赤）
 * - タップで即時同期（クールダウン無視）
 * - 未ログイン or プラン未選択時は非表示
 * - showLabel=true でPC用テキストラベルを表示
 */
export const SyncButton: React.FC<{ size?: number; className?: string; showLabel?: boolean }> = React.memo(({ size = 16, className, showLabel = false }) => {
    const { t } = useTranslation();
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
        ).then(() => {
            showToast(t('app.sync_push_success'), 'success');
        }).catch(() => {
            showToast(t('app.sync_push_error'), 'error');
        });
    };

    let Icon: React.ElementType = CloudCheck;
    let iconClass = 'text-blue-400';
    let animate = '';
    let labelText = t('app.sync_saved');
    let labelClass = 'text-app-text-muted';

    if (cloudStatus === 'syncing') {
        Icon = CloudUpload;
        iconClass = 'text-app-text/40';
        animate = 'animate-pulse';
        labelText = t('app.sync_syncing');
    } else if (cloudStatus === 'error') {
        Icon = CloudAlert;
        iconClass = 'text-red-400';
        labelText = t('app.sync_error_label');
        labelClass = 'text-red-400';
    } else if (cloudStatus === 'idle') {
        Icon = RefreshCw;
        labelText = t('app.sync_pending');
    }

    return (
        <button
            onClick={handleSync}
            disabled={cloudStatus === 'syncing'}
            className={clsx(
                "flex items-center gap-1.5 rounded transition-all duration-200 hover:bg-app-text/10 active:scale-90 disabled:pointer-events-none",
                iconClass,
                className,
            )}
            style={{ flexShrink: 0 }}
        >
            <Icon size={size} className={animate} />
            {showLabel && (
                <span className={clsx("hidden md:inline text-app-sm font-medium", labelClass)}>
                    {labelText}
                </span>
            )}
        </button>
    );
});
SyncButton.displayName = 'SyncButton';
