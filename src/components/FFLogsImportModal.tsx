import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useIsMobile } from '../hooks/useIsMobile';
import { useStableCallback } from '../hooks/useStableCallback';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton } from './ui/ModalParts';
import { CloudDownload, Loader2, CheckCircle2, LogIn } from 'lucide-react';
import type { FFLogsFight } from '../api/fflogsTypes';
import type { MapperResult } from '../utils/fflogsMapper';
import { fetchAndMapFflogs } from '../lib/fflogs/fetchAndMapFflogs';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import type { ImportMode } from '../utils/importModes';
import { apiFetch } from '../lib/apiClient';
import { LoginModal } from './LoginModal';
import { parseFflogsUrl } from '../lib/fflogs/parseFflogsUrl';
import { IMPORT_RATE_LIMIT, getRemainingImports, recordImport } from '../lib/fflogs/importRateLimit';
import type { ImportStatus } from './fflogsImport/importStatus';
import { FFLogsPreviewStats } from './fflogsImport/FFLogsPreviewStats';
import { FFLogsUrlInput } from './fflogsImport/FFLogsUrlInput';
import { FFLogsMobileSheet } from './fflogsImport/FFLogsMobileSheet';

interface FFLogsImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

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
    const previewStats = (
        <FFLogsPreviewStats
            status={status}
            existingEventCount={existingEventCount}
            importMode={importMode}
            setImportMode={setImportMode}
        />
    );

    /* ────── URL input + parse info (shared) ────── */
    const urlInput = (
        <FFLogsUrlInput
            url={url}
            handleUrlChange={handleUrlChange}
            isLoading={isLoading}
            status={status}
            urlError={urlError}
        />
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
                    {urlInput}
                    {status.phase === 'preview' && (
                        <div className="mt-4">
                            {previewStats}
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
    return (
        <FFLogsMobileSheet
            handleClose={handleClose}
            modalRef={modalRef}
            handleTouchStart={handleTouchStart}
            handleTouchMove={handleTouchMove}
            handleTouchEnd={handleTouchEnd}
            urlInput={urlInput}
            previewStats={previewStats}
            canFetch={canFetch}
            isLoading={isLoading}
            status={status}
            handleFetch={handleFetch}
            handleImport={handleImport}
        />
    );
};
