import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { MigrationMode } from '../utils/jobMigration';
import { ArrowRightLeft, ShieldAlert, Check } from 'lucide-react';
import type { Job } from '../types';

interface JobMigrationModalProps {
    isOpen: boolean;
    oldJob: Job | null;
    newJob: Job;
    memberName: string;
    onConfirm: (mode: MigrationMode) => void;
    onCancel: () => void;
}

export const JobMigrationModal: React.FC<JobMigrationModalProps> = ({
    isOpen,
    oldJob,
    newJob,
    memberName,
    onConfirm,
    onCancel
}) => {
    const { t } = useTranslation();
    const [selectedMode, setSelectedMode] = React.useState<MigrationMode>('inherit');

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
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Modal Box */}
            <div className="relative bg-glass-panel border border-glass-border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">

                {/* Header */}
                <div className="px-5 py-4 border-b border-white/[0.05] bg-gradient-to-r from-blue-500/10 to-transparent flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                        <ArrowRightLeft size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white tracking-wide">
                            {t('migration.title', 'ジョブ変更に伴うスキル引き継ぎ')}
                        </h2>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                            {memberName} のジョブを {oldJob?.name || '未設定'} から {newJob.name} に変更します。
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col gap-3 bg-[#0a0a0c]/80">
                    <p className="text-xs text-slate-300 mb-2 leading-relaxed">
                        {t('migration.description', 'すでに配置されているタイムライン上のスキルをどのように処理するか選択してください。')}
                    </p>

                    {/* Mode Options */}
                    <button
                        onClick={() => setSelectedMode('inherit')}
                        className={clsx(
                            "flex items-start gap-3 p-3 rounded-xl border transition-all text-left group",
                            selectedMode === 'inherit'
                                ? "bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                                : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                        )}
                    >
                        <div className={clsx("mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors",
                            selectedMode === 'inherit' ? "border-blue-400 bg-blue-400" : "border-slate-500"
                        )}>
                            {selectedMode === 'inherit' && <Check size={10} className="text-[#0a0a0c]" strokeWidth={3} />}
                        </div>
                        <div>
                            <div className={clsx("text-sm font-bold mb-1 transition-colors", selectedMode === 'inherit' ? 'text-blue-100' : 'text-slate-300')}>
                                {t('migration.mode.inherit.title', '互換スキルを引き継ぐ (推奨)')}
                            </div>
                            <div className="text-[10px] text-slate-400 leading-snug">
                                {t('migration.mode.inherit.desc', '新しいジョブの対応するスキルに自動で変換します。1対多の専用変換（サモン・セラフィム＋フェイイルミネーションへの置換等）も適用されます。')}
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setSelectedMode('common_only')}
                        className={clsx(
                            "flex items-start gap-3 p-3 rounded-xl border transition-all text-left group",
                            selectedMode === 'common_only'
                                ? "bg-yellow-500/10 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]"
                                : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                        )}
                    >
                        <div className={clsx("mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors",
                            selectedMode === 'common_only' ? "border-yellow-400 bg-yellow-400" : "border-slate-500"
                        )}>
                            {selectedMode === 'common_only' && <Check size={10} className="text-[#0a0a0c]" strokeWidth={3} />}
                        </div>
                        <div>
                            <div className={clsx("text-sm font-bold mb-1 transition-colors", selectedMode === 'common_only' ? 'text-yellow-100' : 'text-slate-300')}>
                                {t('migration.mode.common.title', '共通スキル（ロールアクション）のみ残す')}
                            </div>
                            <div className="text-[10px] text-slate-400 leading-snug">
                                {t('migration.mode.common.desc', 'リプライザルや牽制・アドルなど、全ジョブ共通で持つアクションのみを残し、固有スキルは削除します。')}
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setSelectedMode('reset')}
                        className={clsx(
                            "flex items-start gap-3 p-3 rounded-xl border transition-all text-left group",
                            selectedMode === 'reset'
                                ? "bg-red-500/10 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                                : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                        )}
                    >
                        <div className={clsx("mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors",
                            selectedMode === 'reset' ? "border-red-400 bg-red-400" : "border-slate-500"
                        )}>
                            {selectedMode === 'reset' && <Check size={10} className="text-[#0a0a0c]" strokeWidth={3} />}
                        </div>
                        <div>
                            <div className={clsx("text-sm font-bold mb-1 flex items-center gap-1 transition-colors", selectedMode === 'reset' ? 'text-red-100' : 'text-slate-300')}>
                                <ShieldAlert size={14} className={selectedMode === 'reset' ? "text-red-400" : "text-slate-500"} />
                                {t('migration.mode.reset.title', '配置をすべてリセットする')}
                            </div>
                            <div className="text-[10px] text-slate-400 leading-snug">
                                {t('migration.mode.reset.desc', 'このメンバーが配置しているすべてのスキルをタイムラインから削除します。')}
                            </div>
                        </div>
                    </button>

                </div>

                {/* Footer Controls */}
                <div className="px-5 py-3 border-t border-white/[0.05] bg-[#050505]/50 flex justify-end gap-2 shrink-0">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        {t('common.cancel', 'キャンセル')}
                    </button>
                    <button
                        onClick={() => onConfirm(selectedMode)}
                        className={clsx(
                            "px-6 py-2 rounded-lg text-xs font-bold transition-all shadow-lg hover:scale-105 active:scale-95",
                            selectedMode === 'inherit' ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30" :
                                selectedMode === 'common_only' ? "bg-yellow-600 hover:bg-yellow-500 text-white shadow-yellow-500/30" :
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
