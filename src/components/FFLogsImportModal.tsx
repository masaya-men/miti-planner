import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CloudDownload, AlertCircle, Link, Loader2, CheckCircle2, Swords, Zap, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { resolveFight, fetchFightEvents, fetchDeathEvents } from '../api/fflogs';
import type { FFLogsRawEvent, FFLogsFight } from '../api/fflogs';
import { mapFFLogsToTimeline } from '../utils/fflogsMapper';
import type { MapperResult } from '../utils/fflogsMapper';
import { useMitigationStore } from '../store/useMitigationStore';

interface FFLogsImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type ImportStatus =
    | { phase: 'idle' }
    | { phase: 'loading'; message: string }
    | { phase: 'preview'; fight: FFLogsFight; events: FFLogsRawEvent[]; mapped: MapperResult }
    | { phase: 'error'; message: string };

export const FFLogsImportModal: React.FC<FFLogsImportModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { importTimelineEvents } = useMitigationStore();

    const [url, setUrl] = useState('');
    const [urlError, setUrlError] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<{ reportId: string; fightId: string | null } | null>(null);
    const [status, setStatus] = useState<ImportStatus>({ phase: 'idle' });

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        setUrlError(null);
        setParsedData(null);
        setStatus({ phase: 'idle' });

        if (!newUrl.trim()) return;

        const reportMatch = newUrl.match(/reports\/([a-zA-Z0-9]+)/);
        const fightMatch = newUrl.match(/[#?]fight=([^&]+)/);

        if (reportMatch && reportMatch[1]) {
            setParsedData({
                reportId: reportMatch[1],
                fightId: fightMatch ? fightMatch[1] : null,
            });
        } else {
            setUrlError('Invalid FFLogs URL. Expected format: https://fflogs.com/reports/...');
        }
    };

    /** Phase 2 → fetch raw data, then Phase 3 → map it, show preview */
    const handleFetch = async () => {
        if (!parsedData) return;

        try {
            setStatus({ phase: 'loading', message: 'Resolving fight...' });
            const fight = await resolveFight(parsedData.reportId, parsedData.fightId);

            // Fetch 1: Report's native language (JP) — translate=false (default)
            setStatus({ phase: 'loading', message: `Fetching events (native) for "${fight.name}"...` });
            const eventsJp = await fetchFightEvents(parsedData.reportId, fight, false);

            // Fetch 2: English translation — translate=true
            // Fetch 3: Death events (for filtering hits on dead players)
            setStatus({ phase: 'loading', message: `Fetching events (EN) + deaths for "${fight.name}"...` });
            const [eventsEn, deaths] = await Promise.all([
                fetchFightEvents(parsedData.reportId, fight, true),
                fetchDeathEvents(parsedData.reportId, fight),
            ]);

            setStatus({ phase: 'loading', message: 'Mapping data to timeline...' });
            const mapped = mapFFLogsToTimeline(eventsEn, eventsJp, fight, deaths);

            setStatus({ phase: 'preview', fight, events: eventsEn, mapped });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setStatus({ phase: 'error', message });
        }
    };

    /** Phase 3 → commit mapped events to store */
    const handleImport = () => {
        if (status.phase !== 'preview') return;
        importTimelineEvents(status.mapped.events);
        handleClose();
    };

    const handleClose = () => {
        setUrl('');
        setUrlError(null);
        setParsedData(null);
        setStatus({ phase: 'idle' });
        onClose();
    };

    const isLoading = status.phase === 'loading';
    const canFetch = !!parsedData && !urlError && !isLoading && status.phase !== 'preview';

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6" onClick={handleClose}>
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="relative w-full max-w-lg bg-[#0f1115] border border-white/10 shadow-2xl rounded-2xl overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <CloudDownload size={18} className="text-purple-400" />
                            Import from FFLogs
                        </h2>
                        <button
                            onClick={handleClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1">
                        {/* Description */}
                        <p className="text-sm text-slate-400 mb-1 leading-relaxed">
                            Paste your FFLogs log URL to automatically generate a timeline.
                        </p>
                        <p className="text-xs text-slate-500 mb-4 font-mono">
                            https://ja.fflogs.com/reports/<span className="text-slate-400">reportId</span>#fight=<span className="text-slate-400">fightId</span>
                        </p>

                        {/* URL Input */}
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Link size={16} className="text-slate-500" />
                            </div>
                            <input
                                type="text"
                                value={url}
                                onChange={handleUrlChange}
                                disabled={isLoading || status.phase === 'preview'}
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm font-mono text-slate-300 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 placeholder:text-slate-600 disabled:opacity-50"
                                placeholder="https://fflogs.com/reports/..."
                                spellCheck={false}
                            />
                        </div>

                        {/* URL parse error */}
                        {urlError && (
                            <div className="mt-3 flex items-start gap-2 text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 text-sm">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <p>{urlError}</p>
                            </div>
                        )}

                        {/* Parsed URL preview (before fetch) */}
                        {parsedData && !urlError && status.phase === 'idle' && (
                            <div className="mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Detected</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="text-slate-500 block text-xs">Report ID</span>
                                        <span className="font-mono text-slate-300">{parsedData.reportId}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-xs">Fight ID</span>
                                        <span className="font-mono text-slate-300">{parsedData.fightId ?? 'Auto (Latest kill)'}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Loading state */}
                        {status.phase === 'loading' && (
                            <div className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
                                <Loader2 size={16} className="shrink-0 animate-spin" />
                                <span>{status.message}</span>
                            </div>
                        )}

                        {/* Preview / Confirmation state (Phase 3) */}
                        {status.phase === 'preview' && (
                            <div className="mt-4 space-y-3">
                                {/* Fight info */}
                                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold mb-3">
                                        <CheckCircle2 size={16} />
                                        Ready to import
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                        <div>
                                            <span className="text-slate-500 block text-xs mb-0.5">Fight</span>
                                            <span className="text-slate-200 font-medium">{status.fight.name}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block text-xs mb-0.5">Duration</span>
                                            <span className="text-slate-200 font-medium">
                                                {Math.floor((status.fight.endTime - status.fight.startTime) / 1000 / 60)}m{' '}
                                                {Math.floor(((status.fight.endTime - status.fight.startTime) / 1000) % 60)}s
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Mapped stats */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                                        <Users size={14} className="text-purple-400 mx-auto mb-1" />
                                        <div className="text-lg font-bold text-slate-200">
                                            {status.mapped.stats.timelineEventCount.toLocaleString()}
                                        </div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Timeline Rows</div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                                        <Swords size={14} className="text-orange-400 mx-auto mb-1" />
                                        <div className="text-lg font-bold text-slate-200">
                                            {status.mapped.stats.aaCount.toLocaleString()}
                                        </div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">AA Events</div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                                        <Zap size={14} className="text-yellow-400 mx-auto mb-1" />
                                        <div className="text-lg font-bold text-slate-200">
                                            {(status.mapped.stats.timelineEventCount - status.mapped.stats.aaCount).toLocaleString()}
                                        </div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Mechanics</div>
                                    </div>
                                </div>

                                {/* Warning about overwrite */}
                                <div className="flex items-start gap-2 text-amber-400/80 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 text-xs">
                                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                                    <span>Existing timeline events and mitigations will be replaced.</span>
                                </div>
                            </div>
                        )}

                        {/* API / mapping error */}
                        {status.phase === 'error' && (
                            <div className="mt-4 flex items-start gap-2 text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 text-sm">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <p className="whitespace-pre-wrap">{status.message}</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-4 border-t border-white/5 bg-black/20 flex justify-end gap-3 shrink-0">
                        <button
                            onClick={handleClose}
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                            {t('common.cancel', 'キャンセル')}
                        </button>

                        {/* Show "Fetch Timeline" until preview, then "Import to Timeline" */}
                        {status.phase !== 'preview' ? (
                            <button
                                onClick={handleFetch}
                                disabled={!canFetch}
                                className={clsx(
                                    'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold uppercase transition-all duration-300',
                                    canFetch
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]'
                                        : 'bg-white/5 text-slate-500 cursor-not-allowed'
                                )}
                            >
                                {isLoading
                                    ? <Loader2 size={16} className="animate-spin" />
                                    : <CloudDownload size={16} />
                                }
                                {isLoading ? 'Fetching...' : 'Fetch Timeline'}
                            </button>
                        ) : (
                            <button
                                onClick={handleImport}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold uppercase transition-all duration-300 bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                            >
                                <CheckCircle2 size={16} />
                                Import to Timeline
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
