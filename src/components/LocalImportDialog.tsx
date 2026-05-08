import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SavedPlan } from '../types';
import { useJobs } from '../hooks/useSkillsData';
import { getContentById } from '../data/contentRegistry';
import { getPhaseName } from '../types';
import i18n from '../i18n';

interface LocalImportListDialogProps {
    isOpen: boolean;
    /** 表示対象のプラン (Firestore に既にアップロード済み、ownerId='local' のままの状態) */
    plans: SavedPlan[];
    /** true のとき「次回から自動で表示しない」チェック非表示 (LoginModal 明示ボタン経由用) */
    ignoreDontShow: boolean;
    /** 確定: チェックを外したプラン ID 配列 + dontShow フラグ */
    onConfirm: (params: { uncheckedPlanIds: string[]; dontShow: boolean }) => void;
    /** キャンセル: 何もしない (全プランそのまま Firestore に残る) */
    onCancel: (params: { dontShow: boolean }) => void;
}

export const LocalImportDialog: React.FC<LocalImportListDialogProps> = ({
    isOpen, plans, ignoreDontShow, onConfirm, onCancel,
}) => {
    const { t } = useTranslation();
    const jobs = useJobs();
    // 全プラン ON で初期化
    const [checkedSet, setCheckedSet] = useState<Set<string>>(() => new Set(plans.map(p => p.id)));
    const [dontShow, setDontShow] = useState(false);

    // plans が変わったら checkedSet を再初期化 (再オープン時のため)
    useEffect(() => {
        if (isOpen) {
            setCheckedSet(new Set(plans.map(p => p.id)));
            setDontShow(false);
        }
    }, [isOpen, plans]);

    if (!isOpen) return null;

    const toggle = (planId: string) => {
        setCheckedSet(prev => {
            const next = new Set(prev);
            if (next.has(planId)) next.delete(planId);
            else next.add(planId);
            return next;
        });
    };

    const handleConfirm = () => {
        const uncheckedPlanIds = plans.filter(p => !checkedSet.has(p.id)).map(p => p.id);
        onConfirm({ uncheckedPlanIds, dontShow: ignoreDontShow ? false : dontShow });
    };

    const handleCancel = () => {
        onCancel({ dontShow: ignoreDontShow ? false : dontShow });
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
                        {t('local_import.subtitle')}
                    </p>
                </div>

                {/* List */}
                <div className="px-6 pb-3 max-h-[280px] overflow-y-auto">
                    <ul className="flex flex-col gap-1.5">
                        <AnimatePresence>
                            {plans.map((plan, idx) => {
                                const checked = checkedSet.has(plan.id);
                                const contentLabel = getContentLabel(plan);
                                const jobIcons = getMemberJobIcons(plan);
                                return (
                                    <motion.li
                                        key={plan.id}
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.4 + idx * 0.08, duration: 0.3 }}
                                    >
                                        <label
                                            className={clsx(
                                                "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors select-none",
                                                "border",
                                                checked
                                                    ? "bg-app-toggle/8 border-app-toggle/30 hover:bg-app-toggle/12"
                                                    : "bg-app-surface2/30 border-app-border hover:bg-app-surface2/50",
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggle(plan.id)}
                                                className="w-4 h-4 cursor-pointer accent-app-toggle shrink-0"
                                            />
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

                {/* Help text + dontShow checkbox */}
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

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 + plans.length * 0.08 + 0.2, duration: 0.3 }}
                    className="flex items-center justify-end gap-2 px-6 py-4 border-t border-app-border"
                >
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="px-4 py-2 rounded-xl text-app-md font-black text-app-text-sec hover:text-app-text hover:bg-app-surface2 transition-colors border border-transparent hover:border-app-border cursor-pointer"
                    >
                        {t('local_import.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="px-4 py-2 rounded-xl text-app-md font-bold text-white bg-app-blue hover:bg-app-blue-hover transition-all shadow-lg shadow-app-blue/25 cursor-pointer"
                    >
                        {t('local_import.confirm')}
                    </button>
                </motion.div>
            </motion.div>
        </div>,
        document.body,
    );
};
