import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CloudDownload, AlertCircle, Link, Loader2, CheckCircle2 } from 'lucide-react';
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

/* Slide-in animation for buttons */
const slideUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 20, stiffness: 300 } },
    exit: { opacity: 0, y: 20, transition: { duration: 0.15 } }
};

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
            setUrlError(t('fflogs.invalid_url'));
        }
    };

    const handleFetch = async () => {
        if (!parsedData) return;

        try {
            setStatus({ phase: 'loading', message: t('fflogs.resolving') });
            const fight = await resolveFight(
                parsedData.reportId, 
                parsedData.fightId
            );

            setStatus({ phase: 'loading', message: t('fflogs.fetching', { lang: 'JP', name: fight.name }) });
            const eventsJp = await fetchFightEvents(parsedData.reportId, fight, false);

            setStatus({ phase: 'loading', message: t('fflogs.fetching', { lang: 'EN', name: fight.name }) });
            const [eventsEn, deaths] = await Promise.all([
                fetchFightEvents(parsedData.reportId, fight, true),
                fetchDeathEvents(parsedData.reportId, fight),
            ]);

            setStatus({ phase: 'loading', message: t('fflogs.mapping') });
            const mapped = mapFFLogsToTimeline(eventsEn, eventsJp, fight, deaths);

            setStatus({ phase: 'preview', fight, events: eventsEn, mapped });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setStatus({ phase: 'error', message });
        }
    };

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

    // Swipe-to-dismiss for mobile
    const modalRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef(0);
    const isDragging = useRef(false);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY;
        isDragging.current = true;
    }, []);
    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging.current || !modalRef.current) return;
        const dy = e.touches[0].clientY - dragStartY.current;
        if (dy > 0) {
            modalRef.current.style.transform = `translateY(${dy}px)`;
            modalRef.current.style.transition = 'none';
        }
    }, []);
    const handleTouchEnd = useCallback(() => {
        if (!isDragging.current || !modalRef.current) return;
        isDragging.current = false;
        const dy = parseInt(modalRef.current.style.transform.replace(/[^-?\d]/g, '') || '0');
        if (dy > 100) {
            handleClose();
        } else {
            modalRef.current.style.transform = '';
            modalRef.current.style.transition = 'all 0.3s cubic-bezier(0.2,0,0,1)';
        }
    }, []);

    if (!isOpen) return null;

    /* ────── Preview stats (shared) ────── */
    const renderPreviewStats = () => {
        if (status.phase !== 'preview') return null;
        return (
            <div className="space-y-3">
                {/* Fight info */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold mb-3">
                        <CheckCircle2 size={16} />
                        {t('fflogs.ready')}
                    </div>
                    <div className="space-y-4">
                        <div>
                            <span className="text-slate-500 block text-xs mb-1 uppercase tracking-wider">{t('fflogs.fight')}</span>
                            <span className="text-lg font-bold text-slate-100">
                                {status.fight.name}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-500 block text-xs mb-1 uppercase tracking-wider">{t('fflogs.duration')}</span>
                            <span className="text-slate-100 font-bold">
                                {Math.floor((status.fight.endTime - status.fight.startTime) / 1000 / 60)}m{' '}
                                {Math.floor(((status.fight.endTime - status.fight.startTime) / 1000) % 60)}s
                            </span>
                        </div>
                    </div>
                </div>


                {/* Warning about overwrite */}
                <div className="flex items-start gap-2 text-amber-400/80 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 text-xs">
                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                    <span>{t('fflogs.warning_overwrite')}</span>
                </div>
            </div>
        );
    };

    /* ────── URL input + parse info (shared) ────── */
    const renderUrlInput = () => (
        <>
            <p className="text-sm text-slate-400 mb-1 leading-relaxed">
                {t('fflogs.description')}
            </p>
            <p className="text-xs text-slate-500 mb-4 font-mono">
                {t('fflogs.url_format')}
            </p>

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
                    placeholder={t('fflogs.placeholder')}
                    spellCheck={false}
                />
            </div>

            {urlError && (
                <div className="mt-3 flex items-start gap-2 text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 text-sm">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p>{urlError}</p>
                </div>
            )}


            {status.phase === 'loading' && (
                <div className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
                    <Loader2 size={16} className="shrink-0 animate-spin" />
                    <span>{status.message}</span>
                </div>
            )}

            {status.phase === 'error' && (
                <div className="mt-4 flex items-start gap-2 text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 text-sm">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p className="whitespace-pre-wrap">{status.message}</p>
                </div>
            )}
        </>
    );

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex md:items-center md:justify-center" onClick={handleClose}>
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* ─── Mobile: Bottom Sheet with inline step-by-step buttons ─── */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-[201]" onClick={(e) => e.stopPropagation()}>
                    <motion.div
                        ref={modalRef}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="bg-[#0f1115] rounded-t-2xl border-t border-white/10 shadow-2xl flex flex-col max-h-[65vh]"
                    >
                        {/* Drag handle */}
                        <div
                            className="flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing shrink-0"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <div className="w-10 h-1 rounded-full bg-slate-600" />
                        </div>

                        {/* Header */}
                        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                <CloudDownload size={18} className="text-purple-400" />
                                {t('fflogs.title')}
                            </h2>
                            <button
                                onClick={handleClose}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Scrollable Content — ALL buttons are inline here, no fixed footer */}
                        <div className="flex-1 overflow-y-auto overscroll-contain p-5 pb-24">
                            {renderUrlInput()}

                            {/* ─ Step 2: Fetch/Cancel appear after URL is detected ─ */}
                            <AnimatePresence>
                                {canFetch && (
                                    <motion.div {...slideUp} key="fetch-actions" className="mt-5 flex flex-col gap-3">
                                        <button
                                            onClick={handleFetch}
                                            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold uppercase bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)] active:scale-[0.98] transition-transform cursor-pointer"
                                        >
                                            <CloudDownload size={18} />
                                            {t('fflogs.fetch_button')}
                                        </button>
                                        <button
                                            onClick={handleClose}
                                            className="w-full py-3 rounded-xl text-sm font-bold text-slate-400 bg-white/5 border border-white/10 active:bg-white/10 transition-colors cursor-pointer"
                                        >
                                            {t('common.cancel', 'キャンセル')}
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Loading — show spinner inline */}
                            <AnimatePresence>
                                {isLoading && (
                                    <motion.div {...slideUp} key="loading-inline" className="mt-5">
                                        <button
                                            disabled
                                            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold uppercase bg-purple-600/50 text-white/70 cursor-wait"
                                        >
                                            <Loader2 size={18} className="animate-spin" />
                                            {t('fflogs.fetching_button')}
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ─ Step 3: Preview + Import appear after fetch ─ */}
                            <AnimatePresence>
                                {status.phase === 'preview' && (
                                    <motion.div {...slideUp} key="preview-actions" className="mt-5 space-y-4">
                                        {renderPreviewStats()}

                                        <button
                                            onClick={handleImport}
                                            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold uppercase bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-[0.98] transition-transform cursor-pointer"
                                        >
                                            <CheckCircle2 size={18} />
                                            {t('fflogs.import_button')}
                                        </button>
                                        <button
                                            onClick={handleClose}
                                            className="w-full py-3 rounded-xl text-sm font-bold text-slate-400 bg-white/5 border border-white/10 active:bg-white/10 transition-colors cursor-pointer"
                                        >
                                            {t('common.cancel', 'キャンセル')}
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>

                {/* ─── Desktop: Centered Modal (unchanged) ─── */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="hidden md:flex relative w-full max-w-lg bg-[#0f1115] border border-white/10 shadow-2xl rounded-2xl overflow-hidden flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                            <CloudDownload size={18} className="text-purple-400" />
                            {t('fflogs.title')}
                        </h2>
                        <button
                            onClick={handleClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1 overflow-y-auto">
                        {renderUrlInput()}
                        {status.phase === 'preview' && (
                            <div className="mt-4">
                                {renderPreviewStats()}
                            </div>
                        )}
                    </div>

                    {/* Footer — desktop only */}
                    <div className="px-5 py-4 border-t border-white/5 bg-black/20 flex justify-end gap-3 shrink-0">
                        <button
                            onClick={handleClose}
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {t('common.cancel', 'キャンセル')}
                        </button>

                        {status.phase !== 'preview' ? (
                            <button
                                onClick={handleFetch}
                                disabled={!canFetch}
                                className={clsx(
                                    'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold uppercase transition-all duration-300 cursor-pointer',
                                    canFetch
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]'
                                        : 'bg-white/5 text-slate-500 cursor-not-allowed'
                                )}
                            >
                                {isLoading
                                    ? <Loader2 size={16} className="animate-spin" />
                                    : <CloudDownload size={16} />
                                }
                                {isLoading ? t('fflogs.fetching_button') : t('fflogs.fetch_button')}
                            </button>
                        ) : (
                            <button
                                onClick={handleImport}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold uppercase transition-all duration-300 bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] cursor-pointer"
                            >
                                <CheckCircle2 size={16} />
                                {t('fflogs.import_button')}
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
