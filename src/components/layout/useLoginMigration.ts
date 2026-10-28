import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getToken } from 'firebase/app-check';
import { useMitigationStore } from '../../store/useMitigationStore';
import { usePlanStore } from '../../store/usePlanStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLocalImportDialog } from '../../store/useLocalImportDialog';
import { ensureAppCheck, auth } from '../../lib/firebase';

type ImportProgress = { id: string; status: 'uploading' | 'success' | 'failed'; error?: string };
type ImportResult = { id: string; status: 'success' | 'failed'; error?: string };

/** LocalImportDialog(標準/MIL-SPEC 共通)へ渡す値 */
export interface LocalImportProps {
    isOpen: boolean;
    plans: ReturnType<typeof usePlanStore.getState>['plans'];
    onImport: (planIds: string[], onProgress: (event: ImportProgress) => void) => Promise<ImportResult[]>;
    onClose: () => void;
}

// ログイン時のデータマイグレーション（localStorageのプランをFirestoreにアップロード）と、
// その後に開くローカル取り込みダイアログの値。
export function useLoginMigration(isRemoteLoadingRef: React.MutableRefObject<boolean>): LocalImportProps {
    const authUser = useAuthStore((s) => s.user);
    const authLoading = useAuthStore((s) => s.loading);
    const [hasMigrated, setHasMigrated] = React.useState(false);

    // B-1 Revision 3: ローカル取り込みダイアログ
    const localImportOpen = useLocalImportDialog(s => s.isOpen);
    // 注: 以前ここに isImportPreparing / isAuthRedirecting state を持っていたが、
    // ユーザーフィードバックで「ログイン中 / 利用の準備中」 オーバーレイは不要との
    // 判断で撤去。 migrate / pullFromFirestore はバックグラウンドで継続実行する
    // (画面操作とは独立)。
    const closeLocalImportDialog = useLocalImportDialog(s => s.close);
    /**
     * 表示対象: ダイアログで取り込み候補にする plans。
     *
     * 設計: `ownerId === 'local'` (= 未アップロード) かつ
     * `_createdLoggedIn !== true` (= ログイン中に作られたものではない) のみ対象。
     *
     * 理由: ログイン中に作られたプランは Firestore SDK のオフラインキュー経由で
     * 自動同期されるため、 ユーザーに「取り込み確認」 を出す必要が無い。
     * このフィルタにより、 新規作成 / 複製 / コピー直後にリロードしても
     * 誤発火しなくなる。 未ログイン中に作られたプランのみ明示同意フローに乗る。
     */
    const localImportPlans = usePlanStore(
        useShallow(s => s.plans.filter(p =>
            p.ownerId === 'local' && p._createdLoggedIn !== true
        )),
    );

    const handleLocalImport = React.useCallback(
        async (
            planIds: string[],
            onProgress: (event: ImportProgress) => void,
        ): Promise<ImportResult[]> => {
            const currentUser = useAuthStore.getState().user;
            if (!currentUser) return [];
            const profileName = useAuthStore.getState().profileDisplayName || 'User';
            // サマリーはダイアログ内のサマリーパネルで完結する (B-1 Rev3 仕上げ)。
            // 旧 toast (toast_success / toast_partial / toast_all_failed) は撤去済み。
            return await usePlanStore.getState().executeLocalImport(
                currentUser.uid,
                profileName,
                planIds,
                onProgress,
            );
        },
        [],
    );

    const handleLocalImportClose = React.useCallback(
        () => {
            closeLocalImportDialog();
        },
        [closeLocalImportDialog],
    );

    // ログアウト時（authUser=null）にフラグをリセット → 再ログイン時にmigrateOnLoginが再実行される
    React.useEffect(() => {
        if (!authUser) {
            setHasMigrated(false);
            if (usePlanStore.getState()._migrationDone) usePlanStore.setState({ _migrationDone: false });
        }
    }, [authUser, hasMigrated]);
    React.useEffect(() => {
        if (authLoading || !authUser || hasMigrated) return;
        setHasMigrated(true);
        // 注: 以前ここで setIsImportPreparing(true) して「ログイン中」 オーバーレイを
        // 表示していたが、 ユーザーフィードバックで撤去。 migrate / pullFromFirestore は
        // ユーザー操作とは独立にバックグラウンドで完了させる。
        const planStore = usePlanStore.getState();
        const profileName = useAuthStore.getState().profileDisplayName || 'User';
        planStore.migrateOnLogin(
            authUser.uid,
            profileName,
        ).then((keptLocalEdits) => {
            // 取り込みの間に置いた軽減等は、古い内容で読み直さず手元を残す (2026-10-28 消失)
            if (keptLocalEdits) return;
            // マイグレーション後: Firestoreからマージした最新データをMitigationStoreに反映
            const { currentPlanId, plans } = usePlanStore.getState();
            if (currentPlanId) {
                const plan = plans.find(p => p.id === currentPlanId);
                if (plan?.data) {
                    isRemoteLoadingRef.current = true;
                    // 根治(I-2): 現在プランを再ロード → 持ち主IDも明示
                    useMitigationStore.getState().loadSnapshot(plan.data, currentPlanId);
                    isRemoteLoadingRef.current = false;
                }
            }
        }).catch((err) => {
            console.error('[LoPo] migrateOnLogin失敗、PULLで回復を試行:', err);
        }).finally(async () => {
            usePlanStore.setState({ _migrationDone: true });
            // PULL: 他端末の変更を確実に取得 (失敗しても致命ではないので無視)
            try {
                await planStore.pullFromFirestore(authUser.uid);
            } catch {
                // pull 失敗 → 次回 pull で回復
            }

            // B-1 Revision 3: ローカル取り込みダイアログを開く前に App Check + ID トークンを揃える
            // - OAuth リダイレクト直後は reCAPTCHA Enterprise トークン未取得で createPlan が permission-denied になる
            // - ダイアログを開く時点でトークン完備にしておけば、ユーザーが「取り込む」押下した瞬間に成功する
            try {
                const appCheck = ensureAppCheck();
                if (appCheck) {
                    // forceRefresh: true で確実に新規トークン取得 (post-OAuth キャッシュ空対策)
                    await getToken(appCheck, true);
                }
                if (auth.currentUser) {
                    await auth.currentUser.getIdToken(true);
                }
            } catch {
                // トークン取得失敗でもダイアログは出す (executeLocalImport で再試行可能)
            }

            // 自動トリガー: ローカルプランがあるときは常に表示する (Phase B-1.5 Task 11)
            // 旧 `lopo_local_import_dont_show` localStorage フラグは既存ユーザーの値を残したまま読み捨てる
            //
            // 注意: フィルタは localImportPlans (= 上の useShallow) と必ず一致させる。
            // `_createdLoggedIn === true` のプランはログイン中に作られた = 自動同期される
            // ため除外し、 誤発火を防ぐ。
            const localPlanCount = usePlanStore.getState().plans.filter(p =>
                p.ownerId === 'local' && p._createdLoggedIn !== true
            ).length;
            if (localPlanCount > 0) {
                // 微小ディレイ (40ms) は state コミット安定化のため残す
                setTimeout(() => {
                    useLocalImportDialog.getState().open();
                }, 40);
            }
        });
    }, [authUser, authLoading, hasMigrated, isRemoteLoadingRef]);

    return { isOpen: localImportOpen, plans: localImportPlans, onImport: handleLocalImport, onClose: handleLocalImportClose };
}
