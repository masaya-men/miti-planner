import { useState, useEffect, useMemo, useRef, type RefObject } from 'react';
import type { SavedPlan } from '../../types';
import { parsePlanLimitError, type ParsedPlanLimit } from '../../utils/planLimitError';
import { PER_PLAN_MS, type PlanProgressStatus } from './progress';

/**
 * 最後の行の sweep 完了からサマリーパネルを表示するまでの間。
 * ✓/✗ アイコンの drop-in (約 360ms) をユーザーがしっかり視認できる時間を確保。
 */
const SWEEP_TO_SUMMARY_MS = 1000;


interface UseLocalImportFlowArgs {
    isOpen: boolean;
    plans: SavedPlan[];
    onImport: (
        planIds: string[],
        onProgress: (event: { id: string; status: 'uploading' | 'success' | 'failed'; error?: string }) => void,
    ) => Promise<{ id: string; status: 'success' | 'failed'; error?: string }[]>;
    onClose: () => void;
    /** body スクロールエリア (sweep 中の行を viewport 中央へ自動スクロールする用) */
    bodyRef: RefObject<HTMLDivElement | null>;
}

export const useLocalImportFlow = ({ isOpen, plans, onImport, onClose, bodyRef }: UseLocalImportFlowArgs) => {
    /**
     * 表示用プランのスナップショット。
     *
     * 親 (Layout.tsx) は `usePlanStore.plans.filter(p => p.ownerId === 'local')` を
     * リアクティブに購読しており、各プランの取り込みが成功する度に
     * `executeLocalImport` 内で `ownerId` が `'local'` → `uid` に書き換わる
     * → filter から除外され、`plans` prop が縮んでいく。
     *
     * このため、表示は「ダイアログを開いた瞬間の plans」に固定する必要がある。
     * 取り込み成功後も行が消えず、ダイアログサイズも動かないことを保証する。
     */
    const [snapshotPlans, setSnapshotPlans] = useState<SavedPlan[]>([]);
    // 全プラン ON で初期化
    const [checkedSet, setCheckedSet] = useState<Set<string>>(new Set());
    const [phase, setPhase] = useState<'idle' | 'uploading' | 'done'>('idle');
    const [progressMap, setProgressMap] = useState<Map<string, PlanProgressStatus>>(new Map());
    const [errorMap, setErrorMap] = useState<Map<string, string>>(new Map());
    /** 各行の uploading 開始時刻 (B2 sweep の最低秒数を保証するため、結果反映を遅延させる用) */
    const uploadStartTimes = useRef<Map<string, number>>(new Map());

    // ダイアログが「閉→開」に変化した瞬間にだけ plans をスナップショット + state を再初期化
    // (deps から plans を外すことで、取り込み中の親の plans 縮小に反応しない)
    useEffect(() => {
        if (isOpen) {
            setSnapshotPlans(plans);
            setCheckedSet(new Set(plans.map(p => p.id)));
            setPhase('idle');
            setProgressMap(new Map());
            setErrorMap(new Map());
            uploadStartTimes.current = new Map();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const successCount = useMemo(
        () => [...progressMap.values()].filter(s => s === 'success').length,
        [progressMap],
    );
    const failedCount = useMemo(
        () => [...progressMap.values()].filter(s => s === 'failed').length,
        [progressMap],
    );
    const finishedCount = successCount + failedCount;
    const totalCount = progressMap.size;

    /** done 時のサマリー種別 */
    const summaryKind: 'success' | 'partial' | 'failed' | null = useMemo(() => {
        if (phase !== 'done') return null;
        if (failedCount === 0 && successCount > 0) return 'success';
        if (successCount > 0 && failedCount > 0) return 'partial';
        if (failedCount > 0 && successCount === 0) return 'failed';
        return null;
    }, [phase, successCount, failedCount]);

    /** error 集計: PLAN_LIMIT 系 + その他失敗の有無 */
    const errorSummary = useMemo(() => {
        let maxTotal: ParsedPlanLimit | null = null;
        let maxPerContent: ParsedPlanLimit | null = null;
        let hasOtherFailure = false;
        for (const [id, status] of progressMap) {
            if (status !== 'failed') continue;
            const errMsg = errorMap.get(id);
            const parsed = parsePlanLimitError(errMsg);
            if (parsed?.reason === 'max_total') {
                if (!maxTotal) maxTotal = parsed;
            } else if (parsed?.reason === 'max_per_content') {
                if (!maxPerContent) maxPerContent = parsed;
            } else {
                hasOtherFailure = true;
            }
        }
        return { maxTotal, maxPerContent, hasOtherFailure };
    }, [progressMap, errorMap]);

    const toggle = (planId: string) => {
        if (phase !== 'idle') return;
        setCheckedSet(prev => {
            const next = new Set(prev);
            if (next.has(planId)) next.delete(planId);
            else next.add(planId);
            return next;
        });
    };

    const startImport = async (idsToImport: string[]) => {
        if (idsToImport.length === 0) {
            // 全部チェック外し → 何もせず閉じる (ローカルに残す扱い)
            onClose();
            return;
        }

        setPhase('uploading');
        // 待機状態で初期化
        setProgressMap(new Map(idsToImport.map(id => [id, 'pending' as PlanProgressStatus])));
        setErrorMap(new Map());
        uploadStartTimes.current = new Map();

        // onProgress: B2 sweep が PER_PLAN_MS 確実に見えるよう、結果反映は遅延させる
        const handleProgress = (event: { id: string; status: 'uploading' | 'success' | 'failed'; error?: string }) => {
            if (event.status === 'uploading') {
                uploadStartTimes.current.set(event.id, Date.now());
                setProgressMap(prev => {
                    const next = new Map(prev);
                    next.set(event.id, 'uploading');
                    return next;
                });
                // 自動スクロール: 現在 sweep 中の行を viewport 中央へ smooth スクロール
                // (リストが長い場合に「いま処理されてる」を視認させる)
                requestAnimationFrame(() => {
                    const rowEl = bodyRef.current?.querySelector<HTMLElement>(`[data-row-id="${event.id}"]`);
                    rowEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
                return;
            }
            // success / failed → sweep 経過時間が PER_PLAN_MS 未満なら遅延、超過していれば即時反映
            const startedAt = uploadStartTimes.current.get(event.id) ?? Date.now();
            const elapsed = Date.now() - startedAt;
            const delay = Math.max(0, PER_PLAN_MS - elapsed);
            setTimeout(() => {
                setProgressMap(prev => {
                    const next = new Map(prev);
                    next.set(event.id, event.status);
                    return next;
                });
                if (event.error) {
                    setErrorMap(prev => {
                        const next = new Map(prev);
                        next.set(event.id, event.error!);
                        return next;
                    });
                }
            }, delay);
        };

        const results = await onImport(idsToImport, handleProgress);

        // 最後の行の sweep が完了するまで待つ
        const allStartTimes = [...uploadStartTimes.current.values()];
        if (allStartTimes.length > 0) {
            const lastStart = Math.max(...allStartTimes);
            const elapsedSinceLast = Date.now() - lastStart;
            const finalDelay = Math.max(0, PER_PLAN_MS - elapsedSinceLast);
            if (finalDelay > 0) {
                await new Promise(r => setTimeout(r, finalDelay));
            }
        }

        // 結果を確実に反映 (onProgress 漏れに対する防御)
        setProgressMap(prev => {
            const next = new Map(prev);
            for (const r of results) next.set(r.id, r.status);
            return next;
        });
        setErrorMap(prev => {
            const next = new Map(prev);
            for (const r of results) {
                if (r.error) next.set(r.id, r.error);
            }
            return next;
        });

        // sweep 完了からサマリーへ少し間を空ける
        await new Promise(r => setTimeout(r, SWEEP_TO_SUMMARY_MS));
        setPhase('done');
    };

    const handleStartImport = () => {
        const idsToImport = snapshotPlans.filter(p => checkedSet.has(p.id)).map(p => p.id);
        void startImport(idsToImport);
    };

    const handleRetryFailed = () => {
        const failedIds = [...progressMap.entries()]
            .filter(([, status]) => status === 'failed')
            .map(([id]) => id);
        if (failedIds.length === 0) return;
        void startImport(failedIds);
    };

    const handleClose = () => {
        if (phase === 'uploading') return; // アップロード中は閉じさせない
        onClose();
    };

    return {
        snapshotPlans, checkedSet, phase, progressMap,
        successCount, failedCount, finishedCount, totalCount,
        summaryKind, errorSummary,
        toggle, handleStartImport, handleRetryFailed, handleClose,
    };
};
