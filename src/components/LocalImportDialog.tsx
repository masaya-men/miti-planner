import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { CloudUpload } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SavedPlan } from '../types';
import { useJobs } from '../hooks/useSkillsData';
import { getContentById } from '../data/contentRegistry';
import { getPhaseName } from '../types';
import i18n from '../i18n';
import { parsePlanLimitError, type ParsedPlanLimit } from '../utils/planLimitError';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton } from './ui/ModalParts';
import { useSmoothWheelScroll } from '../lib/scroll/useSmoothWheelScroll';

import { PER_PLAN_MS, type PlanProgressStatus } from './localImport/progress';
import { LocalImportPlanRow } from './localImport/LocalImportPlanRow';
import { LocalImportSummaryBar } from './localImport/LocalImportSummaryBar';

/**
 * 最後の行の sweep 完了からサマリーパネルを表示するまでの間。
 * ✓/✗ アイコンの drop-in (約 360ms) をユーザーがしっかり視認できる時間を確保。
 */
const SWEEP_TO_SUMMARY_MS = 1000;


interface LocalImportDialogProps {
    isOpen: boolean;
    /** 表示対象のプラン (`ownerId='local'` のローカルプラン) */
    plans: SavedPlan[];
    /**
     * 取り込み実行コールバック。`onProgress` で 1 件ずつの進捗を通知してくる前提。
     * Promise の解決を Dialog 側で待ち、全件結果に応じて UI を切り替える。
     */
    onImport: (
        planIds: string[],
        onProgress: (event: { id: string; status: 'uploading' | 'success' | 'failed'; error?: string }) => void,
    ) => Promise<{ id: string; status: 'success' | 'failed'; error?: string }[]>;
    /** ダイアログを閉じる (キャンセル / 完了後 / 諦める) */
    onClose: () => void;
}

export const LocalImportDialog: React.FC<LocalImportDialogProps> = ({
    isOpen, plans, onImport, onClose,
}) => {
    const { t } = useTranslation();
    const jobs = useJobs();
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
    /** body スクロールエリア (sweep 中の行を viewport 中央へ自動スクロールする用) */
    const bodyRef = useRef<HTMLDivElement | null>(null);
    // isOpen=false のときは return null で body も unmount される → 条件付き enable で罠回避。
    useSmoothWheelScroll(bodyRef, { enabled: isOpen });

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

    if (!isOpen) return null;

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

    const getContentLabel = (plan: SavedPlan): string => {
        if (!plan.contentId) return '';
        const content = getContentById(plan.contentId);
        if (!content) return plan.contentId;
        return getPhaseName(content.name, i18n.language);
    };

    const getMemberJobIcons = (plan: SavedPlan): { id: string; icon: string; jobName: string }[] => {
        const members = plan.data?.partyMembers ?? [];
        return members
            .map(m => {
                if (!m.jobId) return null;
                const job = jobs.find(j => j.id === m.jobId);
                if (!job) return null;
                return { id: m.id, icon: job.icon, jobName: getPhaseName(job.name, i18n.language) };
            })
            .filter((x): x is { id: string; icon: string; jobName: string } => x !== null);
    };

    /** done 時の retry ボタン文言 (フィードバック行と整合させるため、共通変数として算出) */
    const retryLabel = summaryKind === 'partial'
        ? t('local_import.retry_failed')
        : t('local_import.retry');

    /** done 時のフィードバック箱の項目を error 集計から組み立てる */
    const buildFeedbackItems = (): string[] => {
        if (!summaryKind || summaryKind === 'success') return [];
        const items: string[] = [];
        // PLAN_LIMIT 系 (該当があれば必ず筆頭で出す)
        if (errorSummary.maxTotal) {
            items.push(t('local_import.feedback_max_total', {
                max: errorSummary.maxTotal.max,
                retry: retryLabel,
            }));
        }
        if (errorSummary.maxPerContent) {
            items.push(t('local_import.feedback_max_per_content', {
                max: errorSummary.maxPerContent.max,
                retry: retryLabel,
            }));
        }
        // PLAN_LIMIT 以外の失敗があれば network → relogin (全失敗時のみ) → wait の汎用
        if (errorSummary.hasOtherFailure) {
            items.push(t('local_import.feedback_network', { retry: retryLabel }));
            if (summaryKind === 'failed') {
                items.push(t('local_import.feedback_relogin', { retry: retryLabel }));
            }
        }
        // 必ず最後に「時間を置く」
        items.push(t('local_import.feedback_wait', { retry: retryLabel }));
        return items;
    };

    const feedbackItems = buildFeedbackItems();

    /** ヘッダー直下のサブタイトル文言 (done フェーズ以降はサマリーが本体なので空) */
    const renderSubtitle = () => {
        if (phase === 'idle') return t('local_import.subtitle');
        if (phase === 'uploading') {
            return t('local_import.uploading_n_of_m', { current: finishedCount, total: totalCount });
        }
        // done: 詳細はサマリーパネルに集約。ここは空欄 (領域は min-h で確保)
        return '';
    };

    return (
        // 外側クリック・Esc は「キャンセル」と同じ(取り込み前の表は手元に残る)。チェックを付け外しした後は閉じずに縁取りで知らせる(自動の入力ガード)。アップロード中は閉じない
        <ModalShell
            isOpen
            onClose={handleClose}
            layer="confirm"
            locked={phase === 'uploading'}
            panelProps={{ 'data-lenis-prevent': true }}
            // max-h: ヘッダー(~90) + 6 行(60×6) + help(88) + footer(64) + 余白 ≒ 620px
            // これより長いリスト (7 件以上) は body 内 overflow-y-auto でスクロール
            className="w-[480px] max-w-[92vw] max-h-[min(620px,90vh)]"
        >
            {/* Header */}
            <ModalHeader
                icon={
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
                        className="p-1.5 rounded-full bg-app-blue/15"
                    >
                        <CloudUpload size={20} className="text-app-blue" />
                    </motion.div>
                }
                title={t('local_import.title')}
                onClose={handleClose}
                closeLabel={t('common.close')}
                closeDisabled={phase === 'uploading'}
            />
            <p className="px-6 pt-3 pb-3 text-app-md text-app-text-muted min-h-[1.6em] shrink-0">
                {renderSubtitle()}
            </p>
            <div className="relative flex-1 overflow-y-auto" ref={bodyRef}>
                {/* List + Help (背景レイヤー。常に通常の見た目で残し、サマリーは P3 帯としてフッター直上に重なる) */}
                <div className={clsx(
                    "transition-opacity duration-300",
                    phase === 'done' && "pointer-events-none",
                )}>
                    <div className="px-6 pb-3">
                        <ul className="flex flex-col gap-1.5">
                            {snapshotPlans.map((plan, idx) => {
                                const checked = checkedSet.has(plan.id);
                                const status = progressMap.get(plan.id);
                                const contentLabel = getContentLabel(plan);
                                const jobIcons = getMemberJobIcons(plan);
                                return (
                                    <LocalImportPlanRow
                                        key={plan.id}
                                        plan={plan}
                                        idx={idx}
                                        checked={checked}
                                        status={status}
                                        contentLabel={contentLabel}
                                        jobIcons={jobIcons}
                                        phase={phase}
                                        toggle={toggle}
                                    />
                                );
                            })}
                        </ul>
                    </div>

                    {/* Help 領域 (常時固定スペース確保。idle 時のみ内容表示でガタつき防止) */}
                    <div className="px-6 pb-3 min-h-[88px]">
                        {phase === 'idle' && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 + snapshotPlans.length * 0.08 + 0.1, duration: 0.3 }}
                            >
                                <p className="text-app-base text-app-text-muted leading-relaxed">
                                    {t('local_import.help_text')}
                                </p>
                            </motion.div>
                        )}
                    </div>

                </div>
            </div>

            {/* P3 帯: body の外、 footer の前に flex children として配置。
                body のスクロールから完全独立し、フッター直上の境界線にぴったり吸着して動かない */}
            <LocalImportSummaryBar
                phase={phase}
                summaryKind={summaryKind}
                feedbackItems={feedbackItems}
                successCount={successCount}
                failedCount={failedCount}
            />

            {/* Footer */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + snapshotPlans.length * 0.08 + 0.2, duration: 0.3 }}
                className="shrink-0"
            >
                <ModalFooter>
                    {phase === 'idle' && (
                        <>
                            <ModalButton variant="secondary" onClick={handleClose}>
                                {t('local_import.cancel')}
                            </ModalButton>
                            <ModalButton variant="primary" onClick={handleStartImport}>
                                {t('local_import.confirm')}
                            </ModalButton>
                        </>
                    )}
                    {phase === 'uploading' && (
                        <span className="text-app-md text-app-text-muted">
                            {t('local_import.uploading_in_progress')}
                        </span>
                    )}
                    {phase === 'done' && summaryKind === 'success' && (
                        <ModalButton variant="primary" onClick={handleClose}>
                            {t('local_import.close')}
                        </ModalButton>
                    )}
                    {phase === 'done' && (summaryKind === 'partial' || summaryKind === 'failed') && (
                        <>
                            <ModalButton variant="secondary" onClick={handleClose}>
                                {t('local_import.close')}
                            </ModalButton>
                            <ModalButton variant="primary" onClick={handleRetryFailed}>
                                {retryLabel}
                            </ModalButton>
                        </>
                    )}
                </ModalFooter>
            </motion.div>
        </ModalShell>
    );
};
