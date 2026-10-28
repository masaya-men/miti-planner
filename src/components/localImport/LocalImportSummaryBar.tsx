import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LocalImportSummaryBarProps {
    phase: 'idle' | 'uploading' | 'done';
    summaryKind: 'success' | 'partial' | 'failed' | null;
    feedbackItems: string[];
    successCount: number;
    failedCount: number;
}

export const LocalImportSummaryBar: React.FC<LocalImportSummaryBarProps> = ({
    phase, summaryKind, feedbackItems, successCount, failedCount,
}) => {
    const { t } = useTranslation();
    return (
        <AnimatePresence initial={false}>
            {phase === 'done' && summaryKind && (
                <motion.div
                    key="summary-bar"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                    className="shrink-0 overflow-hidden"
                >
                    {/* フィードバック箱 (失敗時のみ、帯の上に積み重なる) */}
                    {feedbackItems.length > 0 && (
                        <div className="border-t border-app-border bg-app-amber/10 px-6 py-3 text-left">
                            <p className="text-app-md font-bold tracking-wide text-app-amber mb-1">
                                {t('local_import.feedback_box_title')}
                            </p>
                            <ul className="list-disc pl-5 text-app-base text-app-text-sec leading-[1.7]">
                                {feedbackItems.map((item, idx) => (
                                    <li key={idx}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {/* 帯本体: アイコン (左) + タイトル (右) 横並び、完全不透明、左右壁ぴったり */}
                    <div
                        className="border-t border-app-border flex items-center gap-3 px-6 py-3 shadow-[0_-6px_18px_rgba(0,0,0,0.18)]"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                    >
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 }}
                            className={clsx(
                                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                summaryKind === 'success' && 'bg-app-blue/15 text-app-blue',
                                summaryKind === 'partial' && 'bg-app-amber/15 text-app-amber',
                                summaryKind === 'failed' && 'bg-app-red/15 text-app-red',
                            )}
                        >
                            {summaryKind === 'success'
                                ? <CheckCircle2 size={22} />
                                : <AlertTriangle size={22} />}
                        </motion.div>
                        <div className="flex-1 min-w-0 text-left">
                            <h3 className="text-app-2xl font-black tracking-wide text-app-text leading-tight">
                                {summaryKind === 'success' && t('local_import.summary_success_title', { count: successCount })}
                                {summaryKind === 'partial' && t('local_import.summary_partial_title')}
                                {summaryKind === 'failed' && t('local_import.summary_all_failed_title')}
                            </h3>
                            {summaryKind === 'partial' && (
                                <div className="flex items-center gap-2 mt-0.5 text-app-md font-bold">
                                    <span className="text-app-blue">
                                        {t('local_import.summary_partial_stat', { success: successCount, failed: failedCount }).split('・')[0]}
                                    </span>
                                    <span className="opacity-40">/</span>
                                    <span className="text-app-red">
                                        {t('local_import.summary_partial_stat', { success: successCount, failed: failedCount }).split('・')[1] ?? ''}
                                    </span>
                                </div>
                            )}
                            {(summaryKind === 'partial' || summaryKind === 'failed') && (
                                <p className="text-app-base text-app-text-muted mt-0.5 leading-snug">
                                    {summaryKind === 'failed'
                                        ? t('local_import.summary_all_failed_detail', { count: failedCount })
                                        : t('local_import.summary_partial_detail')}
                                </p>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
