import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { MigrationMode } from '../utils/jobMigration';
import { ArrowRightLeft, ShieldAlert, Check } from 'lucide-react';
import type { Job } from '../types';
import { getPhaseName } from '../types';
import { useThemeStore } from '../store/useThemeStore';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton } from './ui/ModalParts';

interface JobMigrationModalProps {
    isOpen: boolean;
    oldJob?: Job | null;
    newJob?: Job;
    memberName?: string;
    batchTasks?: { memberName: string; oldJob: Job | null; newJob: Job }[];
    onConfirm: (mode: MigrationMode) => void;
    onCancel: () => void;
}

export const JobMigrationModal: React.FC<JobMigrationModalProps> = ({
    isOpen,
    oldJob,
    newJob,
    memberName,
    batchTasks,
    onConfirm,
    onCancel
}) => {
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();
    const [selectedMode, setSelectedMode] = React.useState<MigrationMode>('inherit');

    // Reset selection when opened
    React.useEffect(() => {
        if (isOpen) {
            setSelectedMode('inherit');
        }
    }, [isOpen]);

    return (
        <ModalShell isOpen={isOpen} onClose={onCancel} className="w-full max-w-md">
                {/* Header */}
                <ModalHeader
                    icon={
                        <span className="p-2 bg-app-text/10 rounded-xl text-app-text">
                            <ArrowRightLeft size={20} />
                        </span>
                    }
                    title={t('migration.title')}
                    onClose={onCancel}
                    closeLabel={t('common.close')}
                />

                {/* Content */}
                <div className="p-5 flex flex-col gap-3 overflow-y-auto">
                    <p className="text-app-base text-app-text-muted">
                        {batchTasks && batchTasks.length >= 2
                            ? t('migration.batch_desc', { count: batchTasks.length })
                            : t('migration.individual_desc', {
                                member: memberName,
                                oldJob: oldJob ? getPhaseName(oldJob.name, contentLanguage) : t('common.unassigned', '未設定'),
                                newJob: newJob ? getPhaseName(newJob.name, contentLanguage) : ''
                              })}
                    </p>
                    <p className="text-app-lg text-app-text mb-2 leading-relaxed">
                        {t('migration.description', 'すでに配置されているタイムライン上のスキルをどのように処理するか選択してください。')}
                    </p>

                    {/* Mode Options */}
                    <button
                        onClick={() => setSelectedMode('inherit')}
                        className={clsx(
                            "flex items-start gap-3 p-3 rounded-xl border transition-all text-left group cursor-pointer",
                            selectedMode === 'inherit'
                                ? "bg-app-blue-dim border-app-blue-border shadow-[0_0_15px_rgba(59,130,246,0.12)]"
                                : "bg-app-surface2 border-app-border hover:bg-app-surface2 hover:border-app-border"
                        )}
                    >
                        <div className={clsx("mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors",
                            selectedMode === 'inherit' ? "border-app-blue bg-app-blue" : "border-app-border"
                        )}>
                            {selectedMode === 'inherit' && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        <div>
                            <div className={clsx("text-app-2xl font-bold mb-1 transition-colors", selectedMode === 'inherit' ? 'text-app-blue' : 'text-app-text')}>
                                {t('migration.mode.inherit.title', '互換スキルを引き継ぐ (推奨)')}
                            </div>
                            <div className="text-app-base text-app-text-muted leading-snug">
                                {t('migration.mode.inherit.desc', '新しいジョブの対応するスキルに自動で変換します。1対多の専用変換（サモン・セラフィム＋フェイイルミネーションへの置換等）も適用されます。')}
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setSelectedMode('common_only')}
                        className={clsx(
                            "flex items-start gap-3 p-3 rounded-xl border transition-all text-left group cursor-pointer",
                            selectedMode === 'common_only'
                                ? "bg-app-blue-dim border-app-blue-border shadow-[0_0_15px_rgba(59,130,246,0.12)]"
                                : "bg-app-surface2 border-app-border hover:bg-app-surface2 hover:border-app-border"
                        )}
                    >
                        <div className={clsx("mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors",
                            selectedMode === 'common_only' ? "border-app-blue bg-app-blue" : "border-app-border"
                        )}>
                            {selectedMode === 'common_only' && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        <div>
                            <div className={clsx("text-app-2xl font-bold mb-1 transition-colors", selectedMode === 'common_only' ? 'text-app-blue' : 'text-app-text')}>
                                {t('migration.mode.common.title', '共通スキル（ロールアクション）のみ残す')}
                            </div>
                            <div className="text-app-base text-app-text-muted leading-snug">
                                {t('migration.mode.common.desc', 'リプライザルや牽制・アドルなど、全ジョブ共通で持つアクションのみを残し、固有スキルは削除します。')}
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setSelectedMode('reset')}
                        className={clsx(
                            "flex items-start gap-3 p-3 rounded-xl border transition-all text-left group cursor-pointer",
                            selectedMode === 'reset'
                                ? "bg-app-red-dim border-app-red-border shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                                : "bg-app-surface2 border-app-border hover:bg-app-surface2 hover:border-app-border"
                        )}
                    >
                        <div className={clsx("mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors",
                            selectedMode === 'reset' ? "border-app-red bg-app-red" : "border-app-border"
                        )}>
                            {selectedMode === 'reset' && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        <div>
                            <div className={clsx("text-app-2xl font-bold mb-1 flex items-center gap-1 transition-colors", selectedMode === 'reset' ? 'text-app-red' : 'text-app-text')}>
                                <ShieldAlert size={14} className={selectedMode === 'reset' ? "text-app-red" : "text-app-text-muted"} />
                                {t('migration.mode.reset.title', '配置をすべてリセットする')}
                            </div>
                            <div className="text-app-base text-app-text-muted leading-snug">
                                {t('migration.mode.reset.desc', 'このメンバーが配置しているすべてのスキルをタイムラインから削除します。')}
                            </div>
                        </div>
                    </button>

                </div>

                {/* Footer Controls */}
                <ModalFooter>
                    <ModalButton variant="secondary" onClick={onCancel}>
                        {t('common.cancel', 'キャンセル')}
                    </ModalButton>
                    <ModalButton
                        variant={selectedMode === 'reset' ? 'danger' : 'primary'}
                        onClick={() => onConfirm(selectedMode)}
                    >
                        {t('migration.confirm', '変更を実行')}
                    </ModalButton>
                </ModalFooter>
        </ModalShell>
    );
};
