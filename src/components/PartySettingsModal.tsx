import { backdropClose } from '../utils/backdropClose';
import { useIsMobile } from '../hooks/useIsMobile';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useMitigationStore } from '../store/useMitigationStore';
import { useJobs } from '../hooks/useSkillsData';
import { User } from 'lucide-react';
import { ModalHeader, CloseButton } from './ui/ModalParts';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { JobMigrationModal } from './JobMigrationModal';
import { useTutorialStore } from '../store/useTutorialStore';
import { SPRING } from '../tokens/motionTokens';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/useThemeStore';
import './PartySettingsModal.css';
import { PartySlotGroups } from './party/PartySlotGroups';
import { usePartyDraftMigration } from './party/usePartyDraftMigration';
import { createPartyJobSelectHandler } from './party/createPartyJobSelectHandler';
import { PartyJobPalette } from './party/PartyJobPalette';
import { PartyMobileJobPicker } from './party/PartyMobileJobPicker';
import { PartyDragGhost } from './party/PartyDragGhost';
import { usePartySheetSwipe } from './party/usePartySheetSwipe';
import { usePartySlotDrag } from './party/usePartySlotDrag';


interface PartySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PartySettingsModal: React.FC<PartySettingsModalProps> = ({ isOpen, onClose }) => {
    useEscapeClose(isOpen, onClose);
    const isMobile = useIsMobile();
    const { t } = useTranslation();
    const { theme, contentLanguage } = useThemeStore();
    const JOBS = useJobs();
    const partyMembers = useMitigationStore(state => state.partyMembers);
    const updatePartyBulk = useMitigationStore(state => state.updatePartyBulk);
    const timelineMitigations = useMitigationStore(state => state.timelineMitigations);
    const setMyMemberId = useMitigationStore(state => state.setMyMemberId);
    const myMemberId = useMitigationStore(state => state.myMemberId);
    const popoverRef = React.useRef<HTMLDivElement>(null);

    // Hybrid UI State
    const [focusedSlot, setFocusedSlot] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);

    // Absolute Rules - DO NOT MODIFY

    const lastMeleeSlotRef = useRef<number>(0);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    const { draftMembers, setDraftMembers, migrationBatch, handleAttemptClose, handleBatchMigrationConfirm, handleBatchMigrationCancel } = usePartyDraftMigration({
        isOpen, onClose, JOBS, partyMembers, timelineMitigations, updatePartyBulk, popoverRef, setFocusedSlot,
    });




    // Memoized Callbacks for SlotItem
    const handleFocusToggle = React.useCallback((index: number) => {
        setFocusedSlot(prev => prev === index ? null : index);
        useTutorialStore.getState().completeEvent('party:slot-focused');
    }, []);

    const handleRemoveJob = React.useCallback((memberId: string) => {
        setDraftMembers(prev => prev.map(m => m.id === memberId ? { ...m, jobId: null } : m));
        setFocusedSlot(null);
        // ── Tutorial: ジョブ削除イベント ──
        useTutorialStore.getState().completeEvent('party:job-removed');
    }, [setDraftMembers]);

    const handleMyJobToggle = React.useCallback((memberId: string, isMyJob: boolean) => {
        setMyMemberId(isMyJob ? null : memberId);
    }, [setMyMemberId]);

    const { drag, handlePaletteDragMove, slotDropRefs } = usePartySlotDrag(setDraftMembers, setFocusedSlot);
    const { handleSheetTouchStart, handleSheetTouchMove, handleSheetTouchEnd } = usePartySheetSwipe(popoverRef, handleAttemptClose);

    const handleJobSelect = createPartyJobSelectHandler({ JOBS, focusedSlot, draftMembers, setDraftMembers, setFocusedSlot, lastMeleeSlotRef });



    const renderJobPalette = () => (
        <PartyJobPalette JOBS={JOBS} contentLanguage={contentLanguage} handleJobSelect={handleJobSelect} drag={drag} />
    );

    if (!mounted) return null;

    return createPortal(
        <div className={clsx(
            "fixed inset-0 z-[10000] flex",
            isOpen ? "pointer-events-auto" : "pointer-events-none"
        )}>
            {/* Backdrop */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="party-backdrop"
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        {...backdropClose(handleAttemptClose)}
                    />
                )}
            </AnimatePresence>

            {/* Slide-Over Panel — Left on PC, Bottom on Mobile */}
            <motion.div
                ref={popoverRef}
                data-tutorial-modal
                data-tutorial="party-settings"
                onMouseMove={handlePaletteDragMove}
                onMouseUp={drag.endDrag}
                className={clsx(
                    "relative flex flex-col float-surface",
                    "md:h-full md:w-[450px] md:max-w-full md:border-r",
                    "max-md:fixed max-md:left-0 max-md:right-0 max-md:max-h-[70vh] max-md:rounded-t-sheet-sm max-md:border-t",
                )}
                initial={false}
                animate={isOpen
                    ? { x: 0, y: 0 }
                    : !isMobile
                        ? { x: '-100%' }
                        : { y: '100%' }
                }
                transition={SPRING.gentle}
                style={{
                    bottom: isMobile ? 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' : undefined,
                }}
            >
                {/* Mobile drag handle */}
                <div
                    className="md:hidden flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing"
                    onTouchStart={handleSheetTouchStart}
                    onTouchMove={handleSheetTouchMove}
                    onTouchEnd={handleSheetTouchEnd}
                >
                    <div className="w-10 h-1 rounded-full bg-app-border" />
                </div>

                {/* ヘッダーエリア */}
                <ModalHeader
                    icon={
                        <span className="p-2 bg-app-text/10 rounded-xl">
                            <User className="text-app-text" size={16} />
                        </span>
                    }
                    title={t('party.configuration_title')}
                    extra={
                        <span data-tutorial="party-settings-close-btn" className="inline-flex">
                            <CloseButton onClick={handleAttemptClose} label={t('common.close')} />
                        </span>
                    }
                />
                <p className="px-5 pt-2 text-app-base font-bold shrink-0">
                    {focusedSlot !== null
                        ? <span className="flex items-center gap-1.5 font-black animate-pulse" style={{ color: 'var(--color-app-green)' }}>
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--color-app-green)' }} />
                            {t('party.manual_mode_desc', { slot: partyMembers[focusedSlot].id })}
                        </span>
                        : <span className="text-app-text dark:drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] font-bold">{t('party.configuration_desc')}</span>
                    }
                </p>

                {/* 上部セクション：8つのスロット（スクロール可能領域） */}
                <div className="flex-1 flex flex-col md:flex-col-reverse overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 pb-20 flex flex-col gap-6 bg-transparent">


                        {/* モバイル用インラインジョブ選択 */}
                        {focusedSlot !== null && isMobile && (
                            <PartyMobileJobPicker
                                focusedSlot={focusedSlot}
                                draftMembers={draftMembers}
                                JOBS={JOBS}
                                contentLanguage={contentLanguage}
                                handleJobSelect={handleJobSelect}
                                setFocusedSlot={setFocusedSlot}
                            />
                        )}

                        <PartySlotGroups
                            draftMembers={draftMembers}
                            slotDropRefs={slotDropRefs}
                            focusedSlot={focusedSlot}
                            myMemberId={myMemberId}
                            drag={drag}
                            theme={theme}
                            JOBS={JOBS}
                            contentLanguage={contentLanguage}
                            handleFocusToggle={handleFocusToggle}
                            handleRemoveJob={handleRemoveJob}
                            handleMyJobToggle={handleMyJobToggle}
                        />
                    </div>

                    {/* ── Tutorial Banner removed to use unified TutorialOverlay ── */}

                    {/* ジョブパレット — PCのみ表示。モバイルではスロット下にインライン表示 */}
                    <div data-tutorial="job-palette" className="hidden md:flex h-auto bg-transparent border-t border-b-0 md:border-b md:border-t-0 border-glass-border p-3 pb-3 flex-col gap-0.5 shrink-0 z-10">
                        {renderJobPalette()}
                    </div>
                </div>
            </motion.div>

            {/* ドラッグゴースト */}
            <PartyDragGhost drag={drag} />

            {/* Render Migration Confirmation over everything else */}
            {migrationBatch && (
                <JobMigrationModal
                    isOpen={migrationBatch.length > 0}
                    oldJob={migrationBatch[0]?.oldJob || null}
                    newJob={migrationBatch[0]?.newJob}
                    memberName={migrationBatch[0]?.memberName}
                    batchTasks={migrationBatch}
                    onConfirm={handleBatchMigrationConfirm}
                    onCancel={handleBatchMigrationCancel}
                />
            )}
        </div>,
        document.body
    );
};
