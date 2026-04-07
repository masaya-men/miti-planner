import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { X, CloudDownload, AlertCircle, Link, Loader2, CheckCircle2, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { resolveFight, fetchFightEvents, fetchDeathEvents, fetchCastEvents, fetchPlayerDetails } from '../api/fflogs';
import type { FFLogsRawEvent, FFLogsFight } from '../api/fflogs';
import { mapFFLogsToTimeline } from '../utils/fflogsMapper';
import type { MapperResult } from '../utils/fflogsMapper';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { apiFetch } from '../lib/apiClient';
import { LoginModal } from './LoginModal';

// クライアント側レート制限: 1時間あたり最大15回
const IMPORT_RATE_LIMIT = 15;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1時間

function getImportTimestamps(): number[] {
    try {
        const raw = localStorage.getItem('fflogs-import-timestamps');
        if (!raw) return [];
        return JSON.parse(raw) as number[];
    } catch {
        return [];
    }
}

function recordImport(): void {
    const now = Date.now();
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    const timestamps = getImportTimestamps().filter(t => t > cutoff);
    timestamps.push(now);
    localStorage.setItem('fflogs-import-timestamps', JSON.stringify(timestamps));
}

function getRemainingImports(): number {
    const now = Date.now();
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    const recentCount = getImportTimestamps().filter(t => t > cutoff).length;
    return Math.max(0, IMPORT_RATE_LIMIT - recentCount);
}

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
    useEscapeClose(isOpen, onClose);
    const { t } = useTranslation();
    const { importTimelineEvents } = useMitigationStore();
    const authUser = useAuthStore((s) => s.user);
    const isLoggedIn = !!authUser;

    const [url, setUrl] = useState('');
    const [urlError, setUrlError] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<{ reportId: string; fightId: string | null } | null>(null);
    const [status, setStatus] = useState<ImportStatus>({ phase: 'idle' });
    const [showLoginModal, setShowLoginModal] = useState(false);

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
        if (!parsedData || !isLoggedIn) return;

        if (getRemainingImports() <= 0) {
            setStatus({ phase: 'error', message: t('fflogs.rate_limit_exceeded', { max: IMPORT_RATE_LIMIT }) });
            return;
        }

        try {
            recordImport();
            setStatus({ phase: 'loading', message: t('fflogs.resolving') });
            const fight = await resolveFight(
                parsedData.reportId,
                parsedData.fightId
            );

            setStatus({ phase: 'loading', message: t('fflogs.fetching_players') });
            const players = await fetchPlayerDetails(parsedData.reportId, fight.id);

            setStatus({ phase: 'loading', message: t('fflogs.fetching', { lang: 'JP+EN', name: fight.name }) });
            const [eventsJp, eventsEn, deaths, castEn, castJp] = await Promise.all([
                fetchFightEvents(parsedData.reportId, fight, false),
                fetchFightEvents(parsedData.reportId, fight, true),
                fetchDeathEvents(parsedData.reportId, fight),
                fetchCastEvents(parsedData.reportId, fight, true),
                fetchCastEvents(parsedData.reportId, fight, false),
            ]);

            setStatus({ phase: 'loading', message: t('fflogs.mapping') });
            const mapped = mapFFLogsToTimeline(eventsEn, eventsJp, fight, deaths, castEn, castJp, players);

            setStatus({ phase: 'preview', fight, events: eventsEn, mapped });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setStatus({ phase: 'error', message });
        }
    };

    // バックグラウンドでテンプレート候補登録を試みる（失敗しても無視）
    const tryAutoRegisterTemplate = useCallback(async (
        mapped: MapperResult,
        fight: FFLogsFight,
        reportId: string,
    ) => {
        try {
            const user = useAuthStore.getState().user;
            if (!user) return;

            const { plans, currentPlanId } = (await import('../store/usePlanStore')).usePlanStore.getState();
            const currentPlan = plans.find(p => p.id === currentPlanId);
            const contentId = currentPlan?.contentId;
            if (!contentId) return;

            const { getContentById } = await import('../data/contentRegistry');
            const contentDef = getContentById(contentId);
            const category = contentDef?.category || 'custom';

            await apiFetch('/api/template?action=auto-register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId,
                    category,
                    timelineEvents: mapped.events,
                    phases: mapped.phases,
                    kill: fight.kill === true,
                    deathCount: 0,
                    sourceReport: reportId,
                }),
            });
        } catch {
            // サイレント失敗 — ユーザーのインポート体験に影響しない
        }
    }, []);

    const handleImport = () => {
        if (status.phase !== 'preview') return;
        importTimelineEvents(status.mapped.events, status.mapped.phases, status.mapped.labels);

        // バックグラウンドでテンプレート候補登録を試みる
        if (parsedData) {
            tryAutoRegisterTemplate(status.mapped, status.fight, parsedData.reportId);
        }

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

    if (!isOpen) {
        // FFLogsモーダルが閉じていてもLoginModalは表示し続ける
        return showLoginModal
            ? <LoginModal isOpen onClose={() => setShowLoginModal(false)} />
            : null;
    }

    /* ────── ログイン必須ガード ────── */
    if (!isLoggedIn) {
        return createPortal(
            <AnimatePresence>
                <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={handleClose}>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-full max-w-md mx-4 glass-tier3 shadow-sm rounded-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-app-border flex items-center justify-between">
                            <h2 className="text-app-3xl font-bold text-app-text flex items-center gap-2">
                                <CloudDownload size={18} />
                                {t('fflogs.title')}
                            </h2>
                            <button onClick={handleClose} className="p-1.5 rounded-lg text-app-text border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-center">
                                <div className="w-12 h-12 rounded-full bg-app-text/10 flex items-center justify-center">
                                    <LogIn size={24} className="text-app-text" />
                                </div>
                            </div>
                            <h3 className="text-center text-app-2xl-plus font-bold text-app-text">
                                {t('fflogs.login_required_title')}
                            </h3>
                            <p className="text-center text-app-2xl text-app-text-muted leading-relaxed">
                                {t('fflogs.login_required_description')}
                            </p>
                            <button
                                onClick={() => { handleClose(); setShowLoginModal(true); }}
                                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-app-2xl font-bold bg-app-text text-app-bg hover:opacity-80 transition-opacity cursor-pointer"
                            >
                                <LogIn size={16} />
                                {t('fflogs.login_button')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>,
            document.body,
        );
    }

    /* ────── Preview stats (shared) ────── */
    const renderPreviewStats = () => {
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


                {/* Warning about overwrite */}
                <div className="flex items-start gap-2 text-app-amber bg-app-amber-dim p-3 rounded-lg border border-app-amber-border text-app-lg">
                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                    <span>{t('fflogs.warning_overwrite')}</span>
                </div>
                {status.mapped.stats.isEnglishOnly && (
                    <p className="text-app-lg text-amber-400">
                        {t('fflogs.english_only_warning')}
                    </p>
                )}
            </div>
        );
    };

    /* ────── URL input + parse info (shared) ────── */
    const renderUrlInput = () => (
        <>
            <p className="text-app-2xl text-app-text-muted mb-1 leading-relaxed">
                {t('fflogs.description')}
            </p>
            <p className="text-app-lg text-app-text-muted mb-4 font-mono">
                {t('fflogs.url_format')}
            </p>

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Link size={16} className="text-app-text-muted" />
                </div>
                <input
                    type="text"
                    value={url}
                    onChange={handleUrlChange}
                    disabled={isLoading || status.phase === 'preview'}
                    className="w-full bg-app-surface2 border border-app-border rounded-xl py-3 pl-10 pr-3 text-[16px] md:text-app-2xl font-mono text-app-text focus:outline-none focus:border-app-text placeholder:text-app-text-muted disabled:opacity-50"
                    placeholder={t('fflogs.placeholder')}
                    spellCheck={false}
                />
            </div>

            {urlError && (
                <div className="mt-3 flex items-start gap-2 text-app-red bg-app-red-dim p-3 rounded-lg border border-app-red-border text-app-2xl">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p>{urlError}</p>
                </div>
            )}


            {status.phase === 'loading' && (
                <div className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-app-text/5 border border-app-border text-app-text text-app-2xl">
                    <Loader2 size={16} className="shrink-0 animate-spin" />
                    <span>{status.message}</span>
                </div>
            )}

            {status.phase === 'error' && (
                <div className="mt-4 flex items-start gap-2 text-app-red bg-app-red-dim p-3 rounded-lg border border-app-red-border text-app-2xl">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p className="whitespace-pre-wrap">{status.message}</p>
                </div>
            )}
        </>
    );

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex md:items-center md:justify-center" onClick={handleClose}>
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                />

                {/* ─── Mobile: Bottom Sheet with inline step-by-step buttons ─── */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-[201]" onClick={(e) => e.stopPropagation()}>
                    <motion.div
                        ref={modalRef}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="glass-tier3 rounded-t-2xl shadow-sm flex flex-col max-h-[65vh]"
                    >
                        {/* Drag handle */}
                        <div
                            className="flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing shrink-0"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <div className="w-10 h-1 rounded-full bg-app-border" />
                        </div>

                        {/* Header */}
                        <div className="px-5 py-3 border-b border-app-border flex items-center justify-between shrink-0">
                            <h2 className="text-app-2xl-plus font-bold text-app-text flex items-center gap-2">
                                <CloudDownload size={18} className="text-app-text" />
                                {t('fflogs.title')}
                            </h2>
                            <button
                                onClick={handleClose}
                                className="p-1.5 rounded-lg text-app-text border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90"
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
                                            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-app-2xl font-bold uppercase bg-app-blue text-white hover:bg-app-blue-hover active:scale-[0.98] transition-transform cursor-pointer"
                                        >
                                            <CloudDownload size={18} />
                                            {t('fflogs.fetch_button')}
                                        </button>
                                        <button
                                            onClick={handleClose}
                                            className="w-full py-3 rounded-xl text-app-2xl font-bold text-app-text bg-app-surface2 border border-app-border active:bg-app-surface2 transition-colors cursor-pointer"
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
                                            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-app-2xl font-bold uppercase bg-app-text/50 text-app-bg/70 cursor-wait"
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
                                            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-app-2xl font-bold uppercase bg-app-blue text-white hover:bg-app-blue-hover active:scale-[0.98] transition-transform cursor-pointer"
                                        >
                                            <CheckCircle2 size={18} />
                                            {t('fflogs.import_button')}
                                        </button>
                                        <button
                                            onClick={handleClose}
                                            className="w-full py-3 rounded-xl text-app-2xl font-bold text-app-text bg-app-surface2 border border-app-border active:bg-app-surface2 transition-colors cursor-pointer"
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
                    className="hidden md:flex relative z-[201] w-full max-w-lg glass-tier3 shadow-sm rounded-2xl overflow-hidden flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-app-border bg-app-surface2 flex items-center justify-between shrink-0">
                        <h2 className="text-app-3xl font-bold text-app-text flex items-center gap-2">
                            <CloudDownload size={18} className="text-app-text" />
                            {t('fflogs.title')}
                        </h2>
                        <button
                            onClick={handleClose}
                            className="p-1.5 rounded-lg text-app-text border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90"
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
                    <div className="px-5 py-4 border-t border-app-border bg-app-surface2 flex justify-end gap-3 shrink-0">
                        <button
                            onClick={handleClose}
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg text-app-2xl font-bold text-app-text border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 disabled:opacity-50 cursor-pointer active:scale-95"
                        >
                            {t('common.cancel', 'キャンセル')}
                        </button>

                        {status.phase !== 'preview' ? (
                            <button
                                onClick={handleFetch}
                                disabled={!canFetch}
                                className={clsx(
                                    'flex items-center gap-2 px-5 py-2 rounded-lg text-app-2xl font-bold uppercase transition-all duration-300 cursor-pointer',
                                    canFetch
                                        ? 'bg-app-blue text-white hover:bg-app-blue-hover'
                                        : 'bg-app-surface2 text-app-text-muted cursor-not-allowed'
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
                                className="flex items-center gap-2 px-5 py-2 rounded-lg text-app-2xl font-bold uppercase transition-all duration-300 bg-app-blue text-white hover:bg-app-blue-hover cursor-pointer"
                            >
                                <CheckCircle2 size={16} />
                                {t('fflogs.import_button')}
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};
