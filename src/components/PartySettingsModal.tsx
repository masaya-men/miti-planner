import { backdropClose } from '../utils/backdropClose';
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
import { migrateMitigations } from '../utils/jobMigration';
import { useTutorialStore } from '../store/useTutorialStore';
import { SPRING } from '../tokens/motionTokens';
import { motion, AnimatePresence } from 'framer-motion';
import type { MigrationMode } from '../utils/jobMigration';
import { useThemeStore } from '../store/useThemeStore';
import type { Job, PartyMember, AppliedMitigation } from '../types';
import './PartySettingsModal.css';
import { SlotItem } from './party/PartySlotItem';
import { mtGroupIndices, stGroupIndices } from './party/partyJobGroups';
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

    // Draft state for party members
    const [draftMembers, setDraftMembers] = useState<PartyMember[]>([]);

    // Batch Migration State
    const [migrationBatch, setMigrationBatch] = useState<{
        memberName: string;
        oldJob: Job | null;
        newJob: Job;
        memberId: string;
    }[] | null>(null);

    // Set draft members when the modal opens
    React.useEffect(() => {
        if (isOpen) {
            setDraftMembers(JSON.parse(JSON.stringify(partyMembers))); // Simple deep copy for draft
        }
    }, [isOpen, partyMembers]);

    const handleAttemptClose = React.useCallback(() => {
        // チュートリアル中はTutorialBlockerがクリック制御するため、ここでは閉じを許可
        // （completeEvent('party:closed')で進行通知）

        if (migrationBatch) return;

        const pendingMigrations: { memberName: string; oldJob: Job | null; newJob: Job; memberId: string }[] = [];
        const safeChanges: { memberId: string; jobId: string | null }[] = [];

        draftMembers.forEach(draftMember => {
            const originalMember = partyMembers.find(m => m.id === draftMember.id);
            if (!originalMember) return;

            if (originalMember.jobId !== draftMember.jobId) {
                const hasMitigations = timelineMitigations.some(m => m.ownerId === draftMember.id);
                if (hasMitigations && originalMember.jobId && draftMember.jobId) {
                    const oldJob = JOBS.find(j => j.id === originalMember.jobId) || null;
                    const newJob = JOBS.find(j => j.id === draftMember.jobId)!;
                    pendingMigrations.push({
                        memberName: draftMember.id,
                        memberId: draftMember.id,
                        oldJob,
                        newJob
                    });
                } else {
                    safeChanges.push({ memberId: draftMember.id, jobId: draftMember.jobId });
                }
            }
        });

        // Apply safe changes immediately if there are no pending migrations
        if (pendingMigrations.length === 0) {
            if (safeChanges.length > 0) {
                updatePartyBulk(safeChanges.map(c => ({ memberId: c.memberId, jobId: c.jobId! })));
            }
            // ── Tutorial: Complete Step 5 ──
            useTutorialStore.getState().completeEvent('party:closed');
            onClose();
        } else {
            // Unsafe changes
            setMigrationBatch(pendingMigrations);
        }
    }, [JOBS, partyMembers, draftMembers, timelineMitigations, migrationBatch, onClose, updatePartyBulk]);

    // ①：画面が完全に閉じた時だけ、状態をリセットする（点滅バグの防止）
    React.useEffect(() => {
        if (!isOpen) {
            setFocusedSlot(null);
            setMigrationBatch(null);
        }
    }, [isOpen]);


    // ②：背景クリックとEscapeキーの検知
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                handleAttemptClose();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === 'Escape') {
                handleAttemptClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleAttemptClose]);


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
    }, []);

    const handleMyJobToggle = React.useCallback((memberId: string, isMyJob: boolean) => {
        setMyMemberId(isMyJob ? null : memberId);
    }, [setMyMemberId]);

    const { drag, handlePaletteDragMove, slotDropRefs } = usePartySlotDrag(setDraftMembers, setFocusedSlot);
    const { handleSheetTouchStart, handleSheetTouchMove, handleSheetTouchEnd } = usePartySheetSwipe(popoverRef, handleAttemptClose);

    const handleJobSelect = createPartyJobSelectHandler({ JOBS, focusedSlot, draftMembers, setDraftMembers, setFocusedSlot, lastMeleeSlotRef });

    // Protected Migration Handlers for Batch Process
    const handleBatchMigrationConfirm = (mode: MigrationMode) => {
        if (!migrationBatch) return;

        const bulkUpdates: { memberId: string, jobId: string | null, mitigations?: AppliedMitigation[] }[] = [];

        // Add any safe changes first
        draftMembers.forEach(draftMember => {
            const originalMember = partyMembers.find(m => m.id === draftMember.id);
            if (originalMember && originalMember.jobId !== draftMember.jobId && !migrationBatch.some(b => b.memberId === draftMember.id)) {
                bulkUpdates.push({ memberId: draftMember.id, jobId: draftMember.jobId });
            }
        });

        // Add migrated changes
        migrationBatch.forEach(({ memberId, oldJob, newJob }) => {
            const memberMitis = useMitigationStore.getState().timelineMitigations.filter(m => m.ownerId === memberId);
            const newMitis = migrateMitigations(oldJob?.id || '', newJob.id, memberId, memberMitis, mode);
            bulkUpdates.push({ memberId, jobId: newJob.id, mitigations: newMitis });
        });

        updatePartyBulk(bulkUpdates);

        setMigrationBatch(null);
        onClose();
    };

    const handleBatchMigrationCancel = () => {
        setMigrationBatch(null);
    };


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
                    "relative flex flex-col glass-tier3 shadow-sm",
                    "md:h-full md:w-[450px] md:max-w-full md:border-r",
                    "max-md:fixed max-md:left-0 max-md:right-0 max-md:max-h-[70vh] max-md:rounded-t-2xl max-md:border-t",
                )}
                initial={false}
                animate={isOpen
                    ? { x: 0, y: 0 }
                    : window.innerWidth >= 768
                        ? { x: '-100%' }
                        : { y: '100%' }
                }
                transition={SPRING.gentle}
                style={{
                    bottom: window.innerWidth < 768 ? 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' : undefined,
                    // PC の左パネルは窓と同じ地(ライトで白)にする。スマホの下シートはそのまま
                    ...(window.innerWidth >= 768 ? { '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties : {}),
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
                        {focusedSlot !== null && typeof window !== 'undefined' && window.innerWidth < 768 && (
                            <PartyMobileJobPicker
                                focusedSlot={focusedSlot}
                                draftMembers={draftMembers}
                                JOBS={JOBS}
                                contentLanguage={contentLanguage}
                                handleJobSelect={handleJobSelect}
                                setFocusedSlot={setFocusedSlot}
                            />
                        )}

                        {/* MTグループ */}
                        <div>
                            <div className="flex items-center justify-between mb-2 pl-1 pr-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-app-text"></span>
                                    <h3 className="text-app-text text-app-md font-black tracking-widest uppercase dark:drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">MT Group</h3>
                                </div>
                                <span className="text-app-sm text-app-text font-bold hidden md:inline-block dark:drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
                                    {t('party.my_job_instruction_new')}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {mtGroupIndices.map(index => {
                                    const member = draftMembers[index];
                                    if (!member) return null;
                                    return (
                                        <div key={member.id} ref={(el) => { if (el) slotDropRefs.current.set(index, el); }}>
                                            <SlotItem
                                                index={index}
                                                member={member}
                                                isFocused={focusedSlot === index}
                                                isMyJob={myMemberId === member.id}
                                                isDropTarget={drag.isDragging && drag.activeTargetId === String(index)}
                                                theme={theme}
                                                jobs={JOBS}
                                                contentLanguage={contentLanguage}
                                                onFocusToggle={handleFocusToggle}
                                                onRemoveJob={handleRemoveJob}
                                                onMyJobToggle={handleMyJobToggle}
                                                {...(index === mtGroupIndices[1] ? { dataTutorial: 'party-healer-slot' } : {})}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* STグループ */}
                        <div>
                            <div className="flex items-center gap-2 mb-2 pl-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-app-text"></span>
                                <h3 className="text-app-text text-app-md font-black tracking-widest uppercase dark:drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">ST Group</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {stGroupIndices.map(index => {
                                    const member = draftMembers[index];
                                    if (!member) return null;
                                    return (
                                        <div key={member.id} ref={(el) => { if (el) slotDropRefs.current.set(index, el); }}>
                                            <SlotItem
                                                index={index}
                                                member={member}
                                                isFocused={focusedSlot === index}
                                                isMyJob={myMemberId === member.id}
                                                isDropTarget={drag.isDragging && drag.activeTargetId === String(index)}
                                                theme={theme}
                                                jobs={JOBS}
                                                contentLanguage={contentLanguage}
                                                onFocusToggle={handleFocusToggle}
                                                onRemoveJob={handleRemoveJob}
                                                onMyJobToggle={handleMyJobToggle}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
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
