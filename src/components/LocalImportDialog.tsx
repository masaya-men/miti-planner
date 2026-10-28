import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { CloudUpload } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SavedPlan } from '../types';
import { useJobs } from '../hooks/useSkillsData';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader } from './ui/ModalParts';
import { useSmoothWheelScroll } from '../lib/scroll/useSmoothWheelScroll';

import { LocalImportPlanRow } from './localImport/LocalImportPlanRow';
import { LocalImportSummaryBar } from './localImport/LocalImportSummaryBar';
import { LocalImportFooter } from './localImport/LocalImportFooter';
import { useLocalImportFlow } from './localImport/useLocalImportFlow';
import { getContentLabel, getMemberJobIcons } from './localImport/planDisplay';
import { buildFeedbackItems } from './localImport/feedbackItems';

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
    /** body スクロールエリア (sweep 中の行を viewport 中央へ自動スクロールする用) */
    const bodyRef = useRef<HTMLDivElement | null>(null);
    // isOpen=false のときは return null で body も unmount される → 条件付き enable で罠回避。
    useSmoothWheelScroll(bodyRef, { enabled: isOpen });

    const {
        snapshotPlans, checkedSet, phase, progressMap,
        successCount, failedCount, finishedCount, totalCount,
        summaryKind, errorSummary,
        toggle, handleStartImport, handleRetryFailed, handleClose,
    } = useLocalImportFlow({ isOpen, plans, onImport, onClose, bodyRef });

    if (!isOpen) return null;

    /** done 時の retry ボタン文言 (フィードバック行と整合させるため、共通変数として算出) */
    const retryLabel = summaryKind === 'partial'
        ? t('local_import.retry_failed')
        : t('local_import.retry');

    const feedbackItems = buildFeedbackItems(summaryKind, errorSummary, retryLabel, t);

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
                                const jobIcons = getMemberJobIcons(plan, jobs);
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
            <LocalImportFooter
                phase={phase}
                summaryKind={summaryKind}
                snapshotPlansLength={snapshotPlans.length}
                retryLabel={retryLabel}
                handleClose={handleClose}
                handleStartImport={handleStartImport}
                handleRetryFailed={handleRetryFailed}
            />
        </ModalShell>
    );
};
