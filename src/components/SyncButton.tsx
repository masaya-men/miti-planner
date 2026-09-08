import React from 'react';
import { CloudCheck, CloudAlert, RotateCw } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { showToast } from './Toast';

/**
 * クラウド同期インジケータ (セッション 22 で「ボタン」 から「インジケータ」 に格下げ)
 *
 * UX 方針:
 * - 普段は静かに状態だけ示す。 ユーザーの不安を煽る色 / 文言は出さない
 * - エラー時のみ色 + 文言で気づかせる (タップで再試行)
 *
 * 表示:
 * - 同期済 / idle: CloudCheck (色なし、 文言なし)
 * - 同期中: RotateCw (くるくる回転、 色なし、 文言なし)
 * - エラー: CloudAlert (赤、 文言あり、 タップで再試行)
 *
 * スマホ (MobileFAB) では完全撤去。 PC のヘッダのみに表示される。
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
            // エラー復帰時のみトーストを出す (通常時は静かに済)
            if (cloudStatus === 'error') {
                showToast(t('app.sync_push_success'), 'success');
            }
        }).catch(() => {
            showToast(t('app.sync_push_error'), 'error');
        });
    };

    const isError = cloudStatus === 'error';
    const isSyncing = cloudStatus === 'syncing';

    // 通常時 / idle: CloudCheck をミュート色で。 文言なし。
    // 同期中: RotateCw をくるくる回転。 文言なし。
    // エラー: CloudAlert を赤で。 文言あり。
    let Icon: React.ElementType = CloudCheck;
    let iconClass = 'text-app-text-muted/60';
    let animate = '';
    let labelText = '';
    const labelClass = 'text-red-400';

    if (isSyncing) {
        Icon = RotateCw;
        iconClass = 'text-app-text-muted/60';
        animate = 'animate-spin';
    } else if (isError) {
        Icon = CloudAlert;
        iconClass = 'text-red-400';
        labelText = t('app.sync_error_label');
    }

    return (
        <button
            onClick={handleSync}
            disabled={isSyncing}
            aria-label={isError ? labelText : t('app.sync_saved')}
            className={clsx(
                "flex items-center gap-1.5 rounded transition-all duration-200 disabled:pointer-events-none",
                // ホバー / 押下フィードバックはエラー時のみ (= タップで再試行を促す)
                isError ? "hover:bg-red-400/10 active:scale-90 cursor-pointer" : "cursor-default",
                iconClass,
                className,
            )}
            style={{ flexShrink: 0 }}
        >
            <Icon size={size} className={animate} />
            {showLabel && isError && (
                <span className={clsx("hidden md:inline text-app-sm font-medium", labelClass)}>
                    {labelText}
                </span>
            )}
        </button>
    );
});
SyncButton.displayName = 'SyncButton';
