import React from 'react';
import clsx from 'clsx';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useTranslation } from 'react-i18next';
import type { MigrationMode } from '../utils/jobMigration';
import { ArrowRightLeft, ShieldAlert, Check } from 'lucide-react';
import type { Job } from '../types';

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
    const { t, i18n } = useTranslation();
    const [selectedMode, setSelectedMode] = React.useState<MigrationMode>('inherit');
    useEscapeClose(isOpen, onCancel);

    // Reset selection when opened
    React.useEffect(() => {
        if (isOpen) {
            setSelectedMode('inherit');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                onClick={onCancel}
            />

            {/* Modal Box */}
            <div className="relative glass-tier3 shadow-sm rounded-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">

                {/* Header */}
                <div className="px-5 py-4 border-b border-app-border flex items-center gap-3">
                    <div className="p-2 bg-app-text/10 rounded-xl text-app-text">
                        <ArrowRightLeft size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white tracking-wide">
                            {t('migration.title')}
                        </h2>
                        <p className="text-[10px] text-app-text mt-0.5">
                            {batchTasks && batchTasks.length >= 2
                                ? t('migration.batch_desc', { count: batchTasks.length })
                                : t('migration.individual_desc', { 
                                    member: memberName, 
                                    oldJob: oldJob ? (i18n.language === 'en' ? oldJob.name.en : oldJob.name.ja) : t('common.unassigned', '未設定'),
                                    newJob: newJob ? (i18n.language === 'en' ? newJob.name.en : newJob.name.ja) : ''
                                  })}
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col gap-3 bg-[#0a0a0c]/80">
                    <p className="text-xs text-app-text mb-2 leading-relaxed">
                        {t('migration.description', 'すでに配置されているタイムライン上のスキルをどのように処理するか選択してください。')}
                    </p>

                    {/* Mode Options */}
                    <button
                        onClick={() => setSelectedMode('inherit')}
                        className={clsx(
                            "flex items-start gap-3 p-3 rounded-xl border transition-all text-left group cursor-pointer",
                            selectedMode === 'inherit'
                                ? "bg-app-text/10 border-app-text"
                                : "bg-app-surface2 border-app-border hover:bg-app-surface2 hover:border-app-border"
                        )}
                    >
                        <div className={clsx("mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors",
                            selectedMode === 'inherit' ? "border-app-text bg-app-text" : "border-app-border"
                        )}>
                            {selectedMode === 'inherit' && <Check size={10} className="text-app-bg" strokeWidth={3} />}
                        </div>
                        <div>
                            <div className={clsx("text-sm font-bold mb-1 transition-colors", selectedMode === 'inherit' ? 'text-app-text' : 'text-app-text')}>
                                {t('migration.mode.inherit.title', '互換スキルを引き継ぐ (推奨)')}
                            </div>
                            <div className="text-[10px] text-app-text-muted leading-snug">
                                {t('migration.mode.inherit.desc', '新しいジョブの対応するスキルに自動で変換します。1対多の専用変換（サモン・セラフィム＋フェイイルミネーションへの置換等）も適用されます。')}
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setSelectedMode('common_only')}
                        className={clsx(
                            "flex items-start gap-3 p-3 rounded-xl border transition-all text-left group cursor-pointer",
                            selectedMode === 'common_only'
                                ? "bg-app-text/10 border-app-text"
                                : "bg-app-surface2 border-app-border hover:bg-app-surface2 hover:border-app-border"
                        )}
                    >
                        <div className={clsx("mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors",
                            selectedMode === 'common_only' ? "border-app-text bg-app-text" : "border-app-border"
                        )}>
                            {selectedMode === 'common_only' && <Check size={10} className="text-app-bg" strokeWidth={3} />}
                        </div>
                        <div>
                            <div className={clsx("text-sm font-bold mb-1 transition-colors", selectedMode === 'common_only' ? 'text-app-text' : 'text-app-text')}>
                                {t('migration.mode.common.title', '共通スキル（ロールアクション）のみ残す')}
                            </div>
                            <div className="text-[10px] text-app-text-muted leading-snug">
                                {t('migration.mode.common.desc', 'リプライザルや牽制・アドルなど、全ジョブ共通で持つアクションのみを残し、固有スキルは削除します。')}
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setSelectedMode('reset')}
                        className={clsx(
                            "flex items-start gap-3 p-3 rounded-xl border transition-all text-left group cursor-pointer",
                            selectedMode === 'reset'
                                ? "bg-red-500/10 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                                : "bg-app-surface2 border-app-border hover:bg-app-surface2 hover:border-app-border"
                        )}
                    >
                        <div className={clsx("mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors",
                            selectedMode === 'reset' ? "border-red-400 bg-red-400" : "border-app-border"
                        )}>
                            {selectedMode === 'reset' && <Check size={10} className="text-[#0a0a0c]" strokeWidth={3} />}
                        </div>
                        <div>
                            <div className={clsx("text-sm font-bold mb-1 flex items-center gap-1 transition-colors", selectedMode === 'reset' ? 'text-red-100' : 'text-app-text')}>
                                <ShieldAlert size={14} className={selectedMode === 'reset' ? "text-red-400" : "text-app-text-muted"} />
                                {t('migration.mode.reset.title', '配置をすべてリセットする')}
                            </div>
                            <div className="text-[10px] text-app-text-muted leading-snug">
                                {t('migration.mode.reset.desc', 'このメンバーが配置しているすべてのスキルをタイムラインから削除します。')}
                            </div>
                        </div>
                    </button>

                </div>

                {/* Footer Controls */}
                <div className="px-5 py-3 border-t border-app-border bg-[#050505]/50 flex justify-end gap-2 shrink-0">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-xs font-medium text-app-text border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-95"
                    >
                        {t('common.cancel', 'キャンセル')}
                    </button>
                    <button
                        onClick={() => onConfirm(selectedMode)}
                        className={clsx(
                            "px-6 py-2 rounded-lg text-xs font-bold transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer",
                            selectedMode === 'inherit' ? "bg-app-text text-app-bg hover:opacity-80" :
                                selectedMode === 'common_only' ? "bg-app-text text-app-bg hover:opacity-80" :
                                    "bg-red-600 hover:bg-red-500 text-white shadow-red-500/30"
                        )}
                    >
                        {t('migration.confirm', '変更を実行')}
                    </button>
                </div>
            </div>
        </div>
    );
};
