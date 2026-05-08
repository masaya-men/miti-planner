import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SavedPlan } from '../types';
import { useJobs } from '../hooks/useSkillsData';
import { getContentById } from '../data/contentRegistry';
import { getPhaseName } from '../types';
import i18n from '../i18n';

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
        onProgress: (event: { id: string; status: 'uploading' | 'success' | 'failed' }) => void,
    ) => Promise<{ id: string; status: 'success' | 'failed' }[]>;
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

    // plans が変わったら state を再初期化 (再オープン時のため)
    useEffect(() => {
        if (isOpen) {
            setCheckedSet(new Set(plans.map(p => p.id)));
            setDontShow(false);
            setPhase('idle');
            setProgressMap(new Map());
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

        const handleProgress = (event: { id: string; status: 'uploading' | 'success' | 'failed' }) => {
            setProgressMap(prev => {
                const next = new Map(prev);
                next.set(event.id, event.status);
                return next;
            });
        };

        const results = await onImport(idsToImport, handleProgress);
        // 最終結果で progressMap を上書き (onProgress 漏れ・遅延に対する防御)
        setProgressMap(prev => {
            const next = new Map(prev);
            for (const r of results) next.set(r.id, r.status);
            return next;
        });
        const allSuccess = results.length > 0 && results.every(r => r.status === 'success');
        setPhase('done');

        if (allSuccess) {
            // 全成功 → 短い遅延で自動クローズ (ユーザーに完了を見せてから)
            setTimeout(() => onClose({ dontShow: ignoreDontShow ? false : dontShow }), 400);
        }
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

    const renderStatusIcon = (status: PlanProgressStatus | undefined) => {
        if (!status || status === 'pending') {
            return <span className="w-4 h-4 rounded-full border border-app-border bg-app-surface2/40 shrink-0" />;
        }
        if (status === 'uploading') {
            return <Loader2 size={16} className="animate-spin text-app-toggle shrink-0" />;
        }
        if (status === 'success') {
            return <CheckCircle2 size={16} className="text-app-toggle shrink-0" />;
        }
        return <XCircle size={16} className="text-app-red shrink-0" />;
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
                    "relative w-[480px] max-w-[92vw] rounded-2xl glass-tier3",
                )}
                style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
            >
                {/* Header */}
                <div className="px-6 pt-6 pb-3">
                    <div className="flex items-center gap-3 mb-1">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
                            className="p-1.5 rounded-full bg-app-toggle/15"
                        >
                            <CheckCircle2 size={20} className="text-app-toggle" />
                        </motion.div>
                        <h3 className="text-app-2xl font-black text-app-text tracking-wide">
                            {t('local_import.title')}
                        </h3>
                    </div>
                    <p className="text-app-md text-app-text-muted ml-10">
                        {phase === 'uploading'
                            ? t('local_import.uploading_n_of_m', { current: successCount + failedCount, total: progressMap.size })
                            : phase === 'done' && failedCount > 0
                                ? t('local_import.partial_failure', { success: successCount, failed: failedCount })
                                : t('local_import.subtitle')}
                    </p>
                </div>

                {/* List */}
                <div className="px-6 pb-3 max-h-[280px] overflow-y-auto">
                    <ul className="flex flex-col gap-1.5">
                        <AnimatePresence>
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
                                                "flex items-center gap-3 p-2.5 rounded-lg select-none border transition-colors",
                                                isInProgress ? "cursor-default" : "cursor-pointer",
                                                checked
                                                    ? "bg-app-toggle/8 border-app-toggle/30"
                                                    : "bg-app-surface2/30 border-app-border",
                                                !isInProgress && checked && "hover:bg-app-toggle/12",
                                                !isInProgress && !checked && "hover:bg-app-surface2/50",
                                            )}
                                        >
                                            {isInProgress ? (
                                                renderStatusIcon(status)
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggle(plan.id)}
                                                    className="w-4 h-4 cursor-pointer accent-app-toggle shrink-0"
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
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
                        </AnimatePresence>
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
                                    className="w-4 h-4 cursor-pointer accent-app-toggle"
                                />
                                <span className="text-app-base text-app-text-muted">
                                    {t('local_import.dont_show_again')}
                                </span>
                            </label>
                        )}
                    </motion.div>
                )}

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 + plans.length * 0.08 + 0.2, duration: 0.3 }}
                    className="flex items-center justify-end gap-2 px-6 py-4 border-t border-app-border"
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

                    {phase === 'done' && failedCount > 0 && (
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
                                {t('local_import.retry_failed')}
                            </button>
                        </>
                    )}
                </motion.div>
            </motion.div>
        </div>,
        document.body,
    );
};
