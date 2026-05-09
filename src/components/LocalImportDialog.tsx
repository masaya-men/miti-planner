import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { CheckCircle2, AlertTriangle, CloudUpload, X as IconX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SavedPlan } from '../types';
import { useJobs } from '../hooks/useSkillsData';
import { getContentById } from '../data/contentRegistry';
import { getPhaseName } from '../types';
import i18n from '../i18n';
import { parsePlanLimitError, type ParsedPlanLimit } from '../utils/planLimitError';

/** 1 件あたりに見せる sweep アニメーション秒数 (実 Firestore が早く返ってもこの時間以上はかける) */
const PER_PLAN_MS = 1000;
/** 最後の行の sweep 完了からサマリーパネルへ切り替えるまでの間 */
const SWEEP_TO_SUMMARY_MS = 350;

/** 各プランの取り込み進捗状態 */
type PlanProgressStatus = 'pending' | 'uploading' | 'success' | 'failed';

interface LocalImportDialogProps {
    isOpen: boolean;
    /** 表示対象のプラン (`ownerId='local'` のローカルプラン) */
    plans: SavedPlan[];
    /** true のとき「次回から表示しない」チェック非表示 */
    ignoreDontShow: boolean;
    /**
     * 取り込み実行コールバック。`onProgress` で 1 件ずつの進捗を通知してくる前提。
     * Promise の解決を Dialog 側で待ち、全件結果に応じて UI を切り替える。
     */
    onImport: (
        planIds: string[],
        onProgress: (event: { id: string; status: 'uploading' | 'success' | 'failed'; error?: string }) => void,
    ) => Promise<{ id: string; status: 'success' | 'failed'; error?: string }[]>;
    /** ダイアログを閉じる (キャンセル / 完了後 / 諦める) */
    onClose: (params: { dontShow: boolean }) => void;
}

export const LocalImportDialog: React.FC<LocalImportDialogProps> = ({
    isOpen, plans, ignoreDontShow, onImport, onClose,
}) => {
    const { t } = useTranslation();
    const jobs = useJobs();
    // 全プラン ON で初期化
    const [checkedSet, setCheckedSet] = useState<Set<string>>(() => new Set(plans.map(p => p.id)));
    const [dontShow, setDontShow] = useState(false);
    const [phase, setPhase] = useState<'idle' | 'uploading' | 'done'>('idle');
    const [progressMap, setProgressMap] = useState<Map<string, PlanProgressStatus>>(new Map());
    const [errorMap, setErrorMap] = useState<Map<string, string>>(new Map());
    /** 各行の uploading 開始時刻 (B2 sweep の最低秒数を保証するため、結果反映を遅延させる用) */
    const uploadStartTimes = useRef<Map<string, number>>(new Map());

    // plans が変わったら state を再初期化 (再オープン時のため)
    useEffect(() => {
        if (isOpen) {
            setCheckedSet(new Set(plans.map(p => p.id)));
            setDontShow(false);
            setPhase('idle');
            setProgressMap(new Map());
            setErrorMap(new Map());
            uploadStartTimes.current = new Map();
        }
    }, [isOpen, plans]);

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
            onClose({ dontShow: ignoreDontShow ? false : dontShow });
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
        const idsToImport = plans.filter(p => checkedSet.has(p.id)).map(p => p.id);
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
        onClose({ dontShow: ignoreDontShow ? false : dontShow });
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

    /** uploading フェーズで sweep バー (B2) を描画する。pending → uploading になった瞬間 width 0→100% へアニメ */
    const renderSweep = (status: PlanProgressStatus | undefined) => {
        // status: pending → width 0 / uploading → 0→100% (PER_PLAN_MS 線形) / success/failed → 100% 固定
        const sweepActive = status === 'uploading' || status === 'success' || status === 'failed';
        const isFailed = status === 'failed';
        return (
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    top: 0, bottom: 0, left: 0,
                    width: sweepActive ? '100%' : '0%',
                    background: isFailed
                        ? 'var(--color-app-red-dim)'
                        : 'var(--color-app-blue-dim)',
                    transition: status === 'uploading'
                        ? `width ${PER_PLAN_MS}ms linear`
                        : 'none',
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />
        );
    };

    const renderStatusIcon = (status: PlanProgressStatus | undefined) => {
        if (!status || status === 'pending') {
            return (
                <span
                    className="w-4 h-4 rounded-full border-2 border-app-text-muted/40 shrink-0"
                    style={{ borderStyle: 'dashed' }}
                />
            );
        }
        if (status === 'uploading') {
            return (
                <span className="w-4 h-4 rounded-full border-2 border-app-blue/60 bg-app-blue/15 shrink-0 animate-pulse" />
            );
        }
        if (status === 'success') {
            return (
                <motion.span
                    initial={{ scale: 0.4, opacity: 0, y: -4 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ duration: 0.36, ease: [0.34, 1.56, 0.64, 1] }}
                    className="shrink-0"
                >
                    <CheckCircle2 size={18} className="text-app-blue" />
                </motion.span>
            );
        }
        return (
            <motion.span
                initial={{ scale: 0.4, opacity: 0, y: -4 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ duration: 0.36, ease: [0.34, 1.56, 0.64, 1] }}
                className="shrink-0"
            >
                <IconX size={18} className="text-app-red" strokeWidth={3} />
            </motion.span>
        );
    };

    /** uploading 中のサブタイトル文言 */
    const renderSubtitle = () => {
        if (phase === 'idle') return t('local_import.subtitle');
        if (phase === 'uploading') {
            return t('local_import.uploading_n_of_m', { current: finishedCount, total: totalCount });
        }
        // done フェーズはサマリーが本体なので subtitle は控えめに
        if (summaryKind === 'success') return t('local_import.summary_success_detail', { count: successCount });
        if (summaryKind === 'failed') return t('local_import.summary_all_failed_detail', { count: failedCount });
        if (summaryKind === 'partial') return t('local_import.summary_partial_detail');
        return '';
    };

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">
            {/* Backdrop: クリック無効化 (誤操作防止) */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px] animate-[fadeIn_300ms_ease-out]" />

            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                className={clsx(
                    "relative w-[480px] max-w-[92vw] max-h-[90vh] flex flex-col rounded-2xl glass-tier3 overflow-hidden",
                )}
                style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
            >
                {/* Header */}
                <div className="px-6 pt-6 pb-3 shrink-0">
                    <div className="flex items-center gap-3 mb-1">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
                            className="p-1.5 rounded-full bg-app-blue/15"
                        >
                            <CloudUpload size={20} className="text-app-blue" />
                        </motion.div>
                        <h3 className="text-app-2xl font-black text-app-text tracking-wide">
                            {t('local_import.title')}
                        </h3>
                    </div>
                    <p className="text-app-md text-app-text-muted ml-10">
                        {renderSubtitle()}
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        {phase !== 'done' ? (
                            <motion.div
                                key="list-phase"
                                initial={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                {/* List */}
                                <div className="px-6 pb-3">
                                    <ul className="flex flex-col gap-1.5">
                                        {plans.map((plan, idx) => {
                                            const checked = checkedSet.has(plan.id);
                                            const status = progressMap.get(plan.id);
                                            const contentLabel = getContentLabel(plan);
                                            const jobIcons = getMemberJobIcons(plan);
                                            const isInProgress = phase !== 'idle';
                                            const isVisibleInProgress = isInProgress && status !== undefined;

                                            // アップロード中・完了フェーズではチェック外したプランを非表示
                                            if (isInProgress && !isVisibleInProgress) return null;

                                            return (
                                                <motion.li
                                                    key={plan.id}
                                                    initial={{ opacity: 0, x: -12 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.4 + idx * 0.08, duration: 0.3 }}
                                                >
                                                    <label
                                                        className={clsx(
                                                            "relative flex items-center gap-3 p-2.5 rounded-lg select-none border transition-colors overflow-hidden",
                                                            isInProgress ? "cursor-default" : "cursor-pointer",
                                                            !isInProgress && checked && "bg-app-blue/10 border-app-blue/30",
                                                            !isInProgress && !checked && "bg-app-surface2/30 border-app-border",
                                                            !isInProgress && checked && "hover:bg-app-blue/15",
                                                            !isInProgress && !checked && "hover:bg-app-surface2/50",
                                                            isInProgress && status === 'success' && "border-app-blue/30",
                                                            isInProgress && status === 'failed' && "border-app-red/30",
                                                            isInProgress && (status === 'pending' || status === 'uploading') && "border-app-border",
                                                        )}
                                                    >
                                                        {/* B2 sweep オーバーレイ (uploading 中の演出) */}
                                                        {isInProgress && renderSweep(status)}

                                                        <span className="relative z-[1] shrink-0 flex items-center justify-center w-[18px] h-[18px]">
                                                            {isInProgress ? (
                                                                renderStatusIcon(status)
                                                            ) : (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => toggle(plan.id)}
                                                                    className="w-4 h-4 cursor-pointer accent-app-blue shrink-0"
                                                                />
                                                            )}
                                                        </span>
                                                        <div className="relative z-[1] flex-1 min-w-0">
                                                            <div className="flex items-baseline gap-2">
                                                                {contentLabel && (
                                                                    <span className="text-app-base font-bold text-app-text-muted shrink-0">
                                                                        [{contentLabel}]
                                                                    </span>
                                                                )}
                                                                <span className="text-app-md font-medium text-app-text truncate">
                                                                    {plan.title || '—'}
                                                                </span>
                                                            </div>
                                                            {jobIcons.length > 0 && (
                                                                <div className="flex items-center gap-0.5 mt-1">
                                                                    {jobIcons.slice(0, 8).map(j => (
                                                                        <img
                                                                            key={j.id}
                                                                            src={j.icon}
                                                                            alt={j.jobName}
                                                                            title={j.jobName}
                                                                            className="w-5 h-5 object-contain opacity-80"
                                                                        />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </label>
                                                </motion.li>
                                            );
                                        })}
                                    </ul>
                                </div>

                                {/* Help text + dontShow checkbox (idle のみ) */}
                                {phase === 'idle' && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.4 + plans.length * 0.08 + 0.1, duration: 0.3 }}
                                        className="px-6 pb-3"
                                    >
                                        <p className="text-app-base text-app-text-muted leading-relaxed">
                                            {t('local_import.help_text')}
                                        </p>
                                        {!ignoreDontShow && (
                                            <label className="mt-3 flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={dontShow}
                                                    onChange={e => setDontShow(e.target.checked)}
                                                    className="w-4 h-4 cursor-pointer accent-app-blue"
                                                />
                                                <span className="text-app-base text-app-text-muted">
                                                    {t('local_import.dont_show_again')}
                                                </span>
                                            </label>
                                        )}
                                    </motion.div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="summary-phase"
                                initial={{ opacity: 0, scale: 0.94, y: 8 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
                                className="px-6 py-7 text-center"
                            >
                                <div
                                    className={clsx(
                                        "w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center",
                                        summaryKind === 'success' && 'bg-app-blue/15 text-app-blue',
                                        summaryKind === 'partial' && 'bg-app-yellow/15 text-app-yellow',
                                        summaryKind === 'failed' && 'bg-app-red/15 text-app-red',
                                    )}
                                >
                                    {summaryKind === 'success'
                                        ? <CheckCircle2 size={36} />
                                        : <AlertTriangle size={36} />}
                                </div>
                                <h3 className="text-app-3xl font-black tracking-wide text-app-text mb-1">
                                    {summaryKind === 'success' && t('local_import.summary_success_title', { count: successCount })}
                                    {summaryKind === 'partial' && t('local_import.summary_partial_title')}
                                    {summaryKind === 'failed' && t('local_import.summary_all_failed_title')}
                                </h3>
                                {summaryKind === 'partial' && (
                                    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-app-surface2 text-app-md font-bold text-app-text-sec">
                                        <span className="text-app-blue">
                                            {t('local_import.summary_partial_stat', { success: successCount, failed: failedCount }).split('・')[0]}
                                        </span>
                                        <span className="opacity-40">/</span>
                                        <span className="text-app-red">
                                            {t('local_import.summary_partial_stat', { success: successCount, failed: failedCount }).split('・')[1] ?? ''}
                                        </span>
                                    </div>
                                )}
                                <p className="text-app-md text-app-text-muted mt-2 leading-relaxed">
                                    {renderSubtitle()}
                                </p>
                                {feedbackItems.length > 0 && (
                                    <div className="mt-5 mx-auto max-w-[380px] px-3.5 py-3 rounded-xl bg-app-yellow/8 border border-app-yellow/30 text-left">
                                        <p className="text-app-md font-bold tracking-wide text-app-yellow mb-1">
                                            {t('local_import.feedback_box_title')}
                                        </p>
                                        <ul className="list-disc pl-5 text-app-base text-app-text-sec leading-[1.7]">
                                            {feedbackItems.map((item, idx) => (
                                                <li key={idx}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 + plans.length * 0.08 + 0.2, duration: 0.3 }}
                    className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-app-border"
                >
                    {phase === 'idle' && (
                        <>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-4 py-2 rounded-xl text-app-md font-black text-app-text-sec hover:text-app-text hover:bg-app-surface2 transition-colors border border-transparent hover:border-app-border cursor-pointer"
                            >
                                {t('local_import.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleStartImport}
                                className="px-4 py-2 rounded-xl text-app-md font-bold text-white bg-app-blue hover:bg-app-blue-hover transition-all shadow-lg shadow-app-blue/25 cursor-pointer"
                            >
                                {t('local_import.confirm')}
                            </button>
                        </>
                    )}

                    {phase === 'uploading' && (
                        <span className="text-app-md text-app-text-muted">
                            {t('local_import.uploading_in_progress')}
                        </span>
                    )}

                    {phase === 'done' && summaryKind === 'success' && (
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 rounded-xl text-app-md font-bold text-white bg-app-blue hover:bg-app-blue-hover transition-all shadow-lg shadow-app-blue/25 cursor-pointer"
                        >
                            {t('local_import.close')}
                        </button>
                    )}

                    {phase === 'done' && (summaryKind === 'partial' || summaryKind === 'failed') && (
                        <>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-4 py-2 rounded-xl text-app-md font-black text-app-text-sec hover:text-app-text hover:bg-app-surface2 transition-colors border border-transparent hover:border-app-border cursor-pointer"
                            >
                                {t('local_import.close')}
                            </button>
                            <button
                                type="button"
                                onClick={handleRetryFailed}
                                className="px-4 py-2 rounded-xl text-app-md font-bold text-white bg-app-blue hover:bg-app-blue-hover transition-all shadow-lg shadow-app-blue/25 cursor-pointer"
                            >
                                {retryLabel}
                            </button>
                        </>
                    )}
                </motion.div>
            </motion.div>
        </div>,
        document.body,
    );
};
