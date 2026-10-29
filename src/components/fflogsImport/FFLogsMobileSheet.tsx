import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CloudDownload, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { backdropClose } from '../../utils/backdropClose';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { ModalButton, ModalHeader } from '../ui/ModalParts';
import type { ImportStatus } from './importStatus';

/* Slide-in animation for buttons */
const slideUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 20, stiffness: 300 } },
    exit: { opacity: 0, y: 20, transition: { duration: 0.15 } }
};

interface FFLogsMobileSheetProps {
    handleClose: () => void;
    /** Esc で閉じる(シートはスマホ・ログイン中・開いている時だけ描かれるので、描かれている間は常に有効) */
    onEscape: () => void;
    modalRef: React.RefObject<HTMLDivElement | null>;
    handleTouchStart: (e: React.TouchEvent) => void;
    handleTouchMove: (e: React.TouchEvent) => void;
    handleTouchEnd: () => void;
    urlInput: React.ReactNode;
    previewStats: React.ReactNode;
    canFetch: boolean;
    isLoading: boolean;
    status: ImportStatus;
    handleFetch: () => void;
    handleImport: () => void;
}

/* ────── Mobile: 下から出るシート(step-by-step ボタン) ────── */
export const FFLogsMobileSheet: React.FC<FFLogsMobileSheetProps> = ({
    handleClose, onEscape, modalRef, handleTouchStart, handleTouchMove, handleTouchEnd,
    urlInput, previewStats, canFetch, isLoading, status, handleFetch, handleImport,
}) => {
    const { t } = useTranslation();
    useEscapeClose(true, onEscape);
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
                        className="float-surface glass-border-b-0 rounded-t-sheet flex flex-col max-h-[65vh]"
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
                            {urlInput}

                            {/* ─ Step 2: Fetch/Cancel appear after URL is detected ─ */}
                            <AnimatePresence>
                                {canFetch && (
                                    <motion.div {...slideUp} key="fetch-actions" className="mt-5 flex flex-col gap-3">
                                        <ModalButton variant="primary" size="lg" onClick={handleFetch} className="w-full px-5 py-3.5">
                                            <CloudDownload size={18} />
                                            {t('fflogs.fetch_button')}
                                        </ModalButton>
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
                                        {previewStats}

                                        <ModalButton variant="primary" size="lg" onClick={handleImport} className="w-full px-5 py-3.5">
                                            <CheckCircle2 size={18} />
                                            {t('fflogs.import_button')}
                                        </ModalButton>
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
