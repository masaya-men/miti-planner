import { backdropClose } from '../utils/backdropClose';
import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useIsMobile } from '../hooks/useIsMobile';
import { useStableCallback } from '../hooks/useStableCallback';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton, INPUT_CLASS } from './ui/ModalParts';
import { CloudDownload, AlertCircle, Link, Loader2, CheckCircle2, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { FFLogsRawEvent, FFLogsFight } from '../api/fflogsTypes';
import type { MapperResult } from '../utils/fflogsMapper';
import { fetchAndMapFflogs } from '../lib/fflogs/fetchAndMapFflogs';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import type { ImportMode } from '../utils/importModes';
import { apiFetch } from '../lib/apiClient';
import { LoginModal } from './LoginModal';
import { parseFflogsUrl } from '../lib/fflogs/parseFflogsUrl';

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
    const isMobile = useIsMobile();
    const { t } = useTranslation();
    const { importTimelineEvents } = useMitigationStore();
    const existingEventCount = useMitigationStore((s) => s.timelineEvents.length);
    const authUser = useAuthStore((s) => s.user);
    const isLoggedIn = !!authUser;
    // Esc: スマホの下から出るシートだけ自前。PC とログイン案内は ModalShell が受け持つ
    useEscapeClose(isOpen && isMobile && isLoggedIn, onClose);

    const [url, setUrl] = useState('');
    const [urlError, setUrlError] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<{ reportId: string; fightId: string | null } | null>(null);
    const [status, setStatus] = useState<ImportStatus>({ phase: 'idle' });
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [importMode, setImportMode] = useState<ImportMode>('replace_keep');

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        setUrlError(null);
        setParsedData(null);
        setStatus({ phase: 'idle' });

        if (!newUrl.trim()) return;

        const parsed = parseFflogsUrl(newUrl);
        if (parsed) {
            setParsedData(parsed);
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
            // 連打ガード: await 前に同期で loading 化（canFetch を即 false に）
            setStatus({ phase: 'loading', message: t('fflogs.resolving') });
            const { fight, events, mapped } = await fetchAndMapFflogs(
                parsedData.reportId,
                parsedData.fightId,
                (phase, ctx) => {
                    if (phase === 'resolving') {
                        setStatus({ phase: 'loading', message: t('fflogs.resolving') });
                    } else if (phase === 'fetching_players') {
                        setStatus({ phase: 'loading', message: t('fflogs.fetching_players') });
                    } else if (phase === 'fetching') {
                        setStatus({ phase: 'loading', message: t('fflogs.fetching', { lang: 'JP+EN', name: ctx?.name ?? '' }) });
                    } else if (phase === 'mapping') {
                        setStatus({ phase: 'loading', message: t('fflogs.mapping') });
                    }
                },
            );
            setStatus({ phase: 'preview', fight, events, mapped });
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
        importTimelineEvents(status.mapped.events, status.mapped.phases, status.mapped.labels, importMode);

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
        setImportMode('replace_keep'); // 次回開いた時に前回モードを引きずらない
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
    // handleClose は毎回作り直されるので、参照は固定したまま最新の中身(onClose)を呼べる形で渡す
    const closeLatest = useStableCallback(handleClose);
    const handleTouchEnd = useCallback(() => {
        if (!isDragging.current || !modalRef.current) return;
        isDragging.current = false;
        const dy = parseInt(modalRef.current.style.transform.replace(/[^-?\d]/g, '') || '0');
        if (dy > 100) {
            closeLatest();
        } else {
            modalRef.current.style.transform = '';
            modalRef.current.style.transition = 'all 0.3s cubic-bezier(0.2,0,0,1)';
        }
    }, [closeLatest]);

    if (!isOpen) {
        // FFLogsモーダルが閉じていてもLoginModalは表示し続ける
        return showLoginModal
            ? <LoginModal isOpen onClose={() => setShowLoginModal(false)} />
            : null;
    }

    /* ────── ログイン必須ガード ────── */
    if (!isLoggedIn) {
        return (
            <ModalShell isOpen onClose={handleClose} className="w-full max-w-md">
                <ModalHeader
                    icon={<CloudDownload size={18} />}
                    title={t('fflogs.title')}
                    onClose={handleClose}
                    closeLabel={t('common.close')}
                />
                <div className="p-6 space-y-4 overflow-y-auto">
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
                    <ModalButton
                        variant="primary"
                        onClick={() => { handleClose(); setShowLoginModal(true); }}
                        className="w-full"
                    >
                        <LogIn size={16} />
                        {t('fflogs.login_button')}
                    </ModalButton>
                </div>
            </ModalShell>
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
                    className={`${INPUT_CLASS} !pl-10 font-mono`}
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

    /* ────── Desktop: 中央の窓 ────── */
    if (!isMobile) {
        return (
            <ModalShell isOpen onClose={handleClose} className="w-full max-w-lg">
                <ModalHeader
                    icon={<CloudDownload size={18} className="text-app-text" />}
                    title={t('fflogs.title')}
                    onClose={handleClose}
                    closeLabel={t('common.close')}
                />

                {/* Content */}
                <div className="p-5 flex-1 overflow-y-auto">
                    {renderUrlInput()}
                    {status.phase === 'preview' && (
                        <div className="mt-4">
                            {renderPreviewStats()}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <ModalFooter>
                    <ModalButton variant="secondary" onClick={handleClose} disabled={isLoading}>
                        {t('common.cancel', 'キャンセル')}
                    </ModalButton>

                    {status.phase !== 'preview' ? (
                        <ModalButton variant="primary" onClick={handleFetch} disabled={!canFetch}>
                            {isLoading
                                ? <Loader2 size={16} className="animate-spin" />
                                : <CloudDownload size={16} />
                            }
                            {isLoading ? t('fflogs.fetching_button') : t('fflogs.fetch_button')}
                        </ModalButton>
                    ) : (
                        <ModalButton variant="primary" onClick={handleImport}>
                            <CheckCircle2 size={16} />
                            {t('fflogs.import_button')}
                        </ModalButton>
                    )}
                </ModalFooter>
            </ModalShell>
        );
    }

    /* ────── Mobile: 下から出るシート(step-by-step ボタン) ────── */
    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex md:items-center md:justify-center" {...backdropClose(handleClose)}>
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    data-backdrop className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
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
                        style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
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
                        <ModalHeader
                            icon={<CloudDownload size={18} className="text-app-text" />}
                            title={t('fflogs.title')}
                            onClose={handleClose}
                            closeLabel={t('common.close')}
                        />

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

            </div>
        </AnimatePresence>,
        document.body
    );
};
