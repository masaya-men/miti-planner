import React from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import type { SavedPlan } from '../../types';
import { SweepOverlay } from '../SweepOverlay';
import { LocalImportStatusIcon } from './LocalImportStatusIcon';
import { PER_PLAN_MS, type PlanProgressStatus } from './progress';

interface LocalImportPlanRowProps {
    plan: SavedPlan;
    idx: number;
    checked: boolean;
    status: PlanProgressStatus | undefined;
    contentLabel: string;
    jobIcons: { id: string; icon: string; jobName: string }[];
    phase: 'idle' | 'uploading' | 'done';
    toggle: (planId: string) => void;
}

export const LocalImportPlanRow: React.FC<LocalImportPlanRowProps> = ({
    plan, idx, checked, status, contentLabel, jobIcons, phase, toggle,
}) => {
    const isInProgress = phase !== 'idle';
    // チェック外したプランも常時表示し、isOutOfImport で薄く見せる
    // (行数が変動しないことでウィンドウのガタつきを完全に抑える)
    const isOutOfImport = isInProgress && status === undefined;

    return (
        <motion.li
            key={plan.id}
            data-row-id={plan.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: isOutOfImport ? 0.35 : 1, x: 0 }}
            transition={{
                delay: phase === 'idle' ? 0.4 + idx * 0.08 : 0,
                duration: 0.3,
            }}
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
                    isOutOfImport && "bg-app-surface2/20 border-app-border",
                )}
            >
                {/* B2 sweep オーバーレイ (uploading 中の演出) */}
                {isInProgress && !isOutOfImport && (
                    <SweepOverlay
                        status={
                            status === 'pending' || !status
                                ? 'idle'
                                : status === 'uploading'
                                    ? 'active'
                                    : status  // 'success' | 'failed'
                        }
                        color="blue"
                        durationMs={PER_PLAN_MS}
                    />
                )}

                <span className="relative z-[1] shrink-0 flex items-center justify-center w-[18px] h-[18px]">
                    {isInProgress ? (
                        isOutOfImport ? (
                            // 取り込み対象外: チェックマークなしの空チェックボックス風表示
                            <span className="w-4 h-4 rounded border border-app-text-muted/40" />
                        ) : (
                            <LocalImportStatusIcon status={status} />
                        )
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
};
