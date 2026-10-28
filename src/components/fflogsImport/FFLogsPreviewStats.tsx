import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import type { ImportMode } from '../../utils/importModes';
import type { ImportStatus } from './importStatus';

interface FFLogsPreviewStatsProps {
    status: ImportStatus;
    existingEventCount: number;
    importMode: ImportMode;
    setImportMode: (m: ImportMode) => void;
}

export const FFLogsPreviewStats: React.FC<FFLogsPreviewStatsProps> = ({ status, existingEventCount, importMode, setImportMode }) => {
    const { t } = useTranslation();
    if (status.phase !== 'preview') return null;
    return (
        <div className="space-y-3">
            {/* Fight info */}
            <div className="p-4 rounded-xl bg-app-text/5 border border-app-border">
                <div className="flex items-center gap-2 text-app-text text-app-2xl font-bold mb-3">
                    <CheckCircle2 size={16} />
                    {t('fflogs.ready')}
                </div>
                <div className="space-y-4">
                    <div>
                        <span className="text-app-text-muted block text-app-lg mb-1 uppercase tracking-wider">{t('fflogs.fight')}</span>
                        <span className="text-app-3xl font-bold text-app-text">
                            {status.fight.name}
                        </span>
                    </div>
                    <div>
                        <span className="text-app-text-muted block text-app-lg mb-1 uppercase tracking-wider">{t('fflogs.duration')}</span>
                        <span className="text-app-text font-bold">
                            {Math.floor((status.fight.endTime - status.fight.startTime) / 1000 / 60)}m{' '}
                            {Math.floor(((status.fight.endTime - status.fight.startTime) / 1000) % 60)}s
                        </span>
                    </div>
                </div>
            </div>


            {/* 取り込みモード選択（既存タイムラインがある時のみ） */}
            {existingEventCount > 0 ? (
                <div className="flex flex-col gap-2">
                    <span className="text-app-text-muted text-app-lg uppercase tracking-wider">
                        {t('fflogs.import_mode.label')}
                    </span>
                    {(['replace_all', 'replace_keep', 'append'] as ImportMode[]).map((m) => (
                        <label
                            key={m}
                            className={clsx(
                                'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all duration-200 text-app-lg',
                                importMode === m
                                    ? 'border-app-text bg-app-text/5 text-app-text'
                                    : 'border-app-border text-app-text-muted hover:border-app-text/40',
                            )}
                        >
                            <input
                                type="radio"
                                name="fflogs-import-mode"
                                value={m}
                                checked={importMode === m}
                                onChange={() => setImportMode(m)}
                                className="accent-app-text"
                            />
                            <span className="flex-1">{t(`fflogs.import_mode.${m}`)}</span>
                            {m === 'replace_all' && (
                                <span className="flex items-center gap-1 text-app-amber text-app-md">
                                    <AlertCircle size={12} className="shrink-0" />
                                    {t('fflogs.import_mode.replace_all_warning')}
                                </span>
                            )}
                        </label>
                    ))}
                </div>
            ) : null}
            {status.mapped.stats.isEnglishOnly && (
                <p className="text-app-lg text-app-amber">
                    {t('fflogs.english_only_warning')}
                </p>
            )}
        </div>
    );
};
