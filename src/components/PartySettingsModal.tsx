import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMitigationStore } from '../store/useMitigationStore';
import { useJobs } from '../hooks/useSkillsData';
import { User, Trash2, Star, X } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { JobMigrationModal } from './JobMigrationModal';
import { migrateMitigations } from '../utils/jobMigration';
import { Ripple } from './Ripple';
import { useTutorialStore, TUTORIAL_STEPS } from '../store/useTutorialStore';
import type { MigrationMode } from '../utils/jobMigration';
import { useThemeStore } from '../store/useThemeStore';
import type { Job, PartyMember, AppliedMitigation } from '../types';
import { Tooltip } from './ui/Tooltip';

interface PartySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PartySettingsModal: React.FC<PartySettingsModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { theme } = useThemeStore();
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

    // ── Tutorial state (additive only) ──
    const { isActive: tutorialActive, currentStepIndex } = useTutorialStore();
    const currentTutorialStep = tutorialActive ? TUTORIAL_STEPS[currentStepIndex] : null;
    const isTutorialSlots = currentTutorialStep?.id === 'party-slots';
    const isTutorialPalette = currentTutorialStep?.id === 'party-palette';
    const isTutorialMyJob = currentTutorialStep?.id === 'party-myjob';
    const isTutorialClose = currentTutorialStep?.id === 'party-close';

    // Absolute Rules - DO NOT MODIFY
    const mtGroupIndices = [0, 2, 4, 6];
    const stGroupIndices = [1, 3, 5, 7];

    // Sub-step sequence for Step 3 (slot-click method)
    const SLOT_TUTORIAL_SEQUENCE: { type: 'slot' | 'job'; slotIndex?: number; jobId?: string }[] = [
        { type: 'slot', slotIndex: 0 }, { type: 'job', jobId: 'drk' },
        { type: 'slot', slotIndex: 2 }, { type: 'job', jobId: 'whm' },
        { type: 'slot', slotIndex: 4 }, { type: 'job', jobId: 'mnk' },
        { type: 'slot', slotIndex: 6 }, { type: 'job', jobId: 'dnc' },
    ];
    // Step 4 palette jobs
    const PALETTE_TUTORIAL_JOBS = ['pld', 'sch', 'drg', 'blm'];

    interface SlotItemProps {
        index: number;
        member: PartyMember;
        isFocused: boolean;
        isMyJob: boolean;
        theme: string;
        tutorialActive: boolean;
        isTutorialSlots: boolean;
        isTutorialPalette: boolean;
        isTutorialMyJob: boolean;
        isTutorialClose: boolean;
        tutorialSubStep: number;
        onFocusToggle: (index: number) => void;
        onRemoveJob: (memberId: string) => void;
        onMyJobToggle: (memberId: string, isMyJob: boolean) => void;
        setTutorialSubStep: React.Dispatch<React.SetStateAction<number>>;
    }

    const SlotItem = React.memo<SlotItemProps>(({
        index, member, isFocused, isMyJob, theme,
        tutorialActive, isTutorialSlots, isTutorialPalette,
        isTutorialMyJob, isTutorialClose, tutorialSubStep,
        onFocusToggle, onRemoveJob, onMyJobToggle, setTutorialSubStep
    }) => {
        if (!member) return null;
        const job = JOBS.find(j => j.id === member.jobId);
        const { t } = useTranslation();

        const getSlotColor = () => {
            if (job) return job.role === 'tank' ? 'blue' : job.role === 'healer' ? 'green' : 'red';
            return member.role === 'tank' ? 'blue' : member.role === 'healer' ? 'green' : 'red';
        };
        const activeColor = getSlotColor();

        const isTutorialTarget = isTutorialSlots && tutorialSubStep < SLOT_TUTORIAL_SEQUENCE.length
            && SLOT_TUTORIAL_SEQUENCE[tutorialSubStep].type === 'slot'
            && SLOT_TUTORIAL_SEQUENCE[tutorialSubStep].slotIndex === index;

        return (
            <div
                id={`party-slot-${index}`}
                data-tutorial={isTutorialTarget ? "party-slots-target" : undefined}
                onClick={() => {
                    // Tutorial: block clicks on non-target slots
                    if (isTutorialSlots && tutorialSubStep < SLOT_TUTORIAL_SEQUENCE.length) {
                        const sub = SLOT_TUTORIAL_SEQUENCE[tutorialSubStep];
                        if (sub.type === 'slot' && sub.slotIndex !== index) return;
                        if (sub.type === 'job') return;
                    }
                    if (isTutorialPalette || isTutorialMyJob || isTutorialClose) return;
                    onFocusToggle(index);
                    // Tutorial: advance sub-step when correct slot is clicked
                    if (isTutorialSlots && tutorialSubStep < SLOT_TUTORIAL_SEQUENCE.length) {
                        const sub = SLOT_TUTORIAL_SEQUENCE[tutorialSubStep];
                        if (sub.type === 'slot' && sub.slotIndex === index && !isFocused) {
                            setTutorialSubStep(prev => prev + 1);
                        }
                    }
                }}
                className={clsx(
                    "btn-tactile h-14 rounded-xl flex items-center justify-between px-3 cursor-pointer border relative group/slot overflow-hidden",
                    isFocused
                        ? activeColor === 'blue'
                            ? "bg-blue-500/[0.12] border-[1.5px] border-blue-300/80"
                            : activeColor === 'green'
                                ? "bg-emerald-500/[0.12] border-[1.5px] border-emerald-300/80"
                                : "bg-rose-500/[0.12] border-[1.5px] border-rose-300/80"
                        : job
                            ? activeColor === 'blue'
                                ? "bg-blue-500/[0.06] border-[1.5px] border-blue-300/50 hover:bg-blue-500/[0.10] hover:border-blue-300/70"
                                : activeColor === 'green'
                                    ? "bg-emerald-500/[0.06] border-[1.5px] border-emerald-300/50 hover:bg-emerald-500/[0.10] hover:border-emerald-300/70"
                                    : "bg-rose-500/[0.06] border-[1.5px] border-rose-300/50 hover:bg-rose-500/[0.10] hover:border-rose-300/70"
                            : activeColor === 'blue'
                                ? "bg-blue-500/[0.03] border-[1.5px] border-blue-300/25 hover:bg-blue-500/[0.06] border-dashed"
                                : activeColor === 'green'
                                    ? "bg-emerald-500/[0.03] border-[1.5px] border-emerald-300/25 hover:bg-emerald-500/[0.06] border-dashed"
                                    : "bg-rose-500/[0.03] border-[1.5px] border-rose-300/25 hover:bg-rose-500/[0.06] border-dashed"
                )}
            >
                {/* 光の反射グラデーション（removed for B/W theme） */}
                {/* 上端の輝くライン（removed for B/W theme） */}

                <Ripple />

                {/* Left side: Tag and Icon */}
                <div className="flex items-center gap-3 z-10 pointer-events-none">
                    <div className={clsx(
                        "text-[10px] font-black tracking-tighter w-6 z-10",
                        theme === 'dark'
                            ? activeColor === 'blue'
                                ? "text-blue-200"
                                : activeColor === 'green'
                                    ? "text-emerald-200"
                                    : "text-rose-200"
                            : activeColor === 'blue'
                                ? "text-blue-800"
                                : activeColor === 'green'
                                    ? "text-emerald-800"
                                    : "text-rose-800"
                    )}>
                        {member.id}
                    </div>
                    {job ? (
                        <img
                            src={job.icon}
                            alt={job.name?.ja}
                            className="w-8 h-8 object-contain"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full border border-app-border bg-app-surface2 flex flex-col items-center justify-center">
                            <span className="text-[8px] text-app-text-muted font-black uppercase tracking-widest">Select</span>
                        </div>
                    )}
                </div>

                {/* Right side: Actions */}
                <div className="flex items-center gap-2 z-20">
                    {job && (
                        <>
                            <button
                                data-tutorial={isTutorialMyJob && member.id === 'ST' ? 'my-job-btn-pld' : undefined}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (tutorialActive && (!isTutorialMyJob || member.id !== 'ST')) return;
                                    onMyJobToggle(member.id, isMyJob);

                                    if (isTutorialMyJob && member.id === 'ST') {
                                        useTutorialStore.getState().completeEvent('my-job:set');
                                    }
                                }}
                                className={clsx("p-2 rounded-lg transition-all flex items-center justify-center border cursor-pointer group/star",
                                    isMyJob
                                        ? "bg-app-text/10 border-app-text text-app-text scale-110"
                                        : "bg-app-surface2 text-app-text/30 border-app-border hover:bg-app-surface2 hover:text-app-text/80"
                                )}
                            >
                                <Tooltip content={t('party.my_job')}>
                                    <Star size={16} className={clsx("transition-all duration-300",
                                        isMyJob
                                            ? "fill-app-text text-app-text"
                                            : "group-hover/star:scale-110"
                                    )} />
                                </Tooltip>
                            </button>
                            <Tooltip content="Remove Job">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isTutorialSlots || isTutorialPalette || isTutorialMyJob || isTutorialClose) return;
                                        onRemoveJob(member.id);
                                    }}
                                    className="px-4 py-2 rounded-xl text-[11px] font-black text-white/40 hover:text-white hover:bg-app-surface2 transition-colors border border-transparent hover:border-app-border cursor-pointer"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </Tooltip>
                        </>
                    )}
                </div>
            </div>
        );
    });


    const [tutorialSubStep, setTutorialSubStep] = useState(0);
    const lastMeleeSlotRef = useRef<number>(0);
    useEffect(() => { setTutorialSubStep(0); }, [currentStepIndex]);

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
        // Tutorial: block closing the modal during the tutorial
        const state = useTutorialStore.getState();
        if (state.isActive) {
            const currentStep = TUTORIAL_STEPS[state.currentStepIndex];
            if (currentStep?.id !== 'party-close') return;
        }

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
            useTutorialStore.getState().completeEvent('party-settings:closed');
            onClose();
        } else {
            // Unsafe changes
            setMigrationBatch(pendingMigrations);
        }
    }, [partyMembers, draftMembers, timelineMitigations, migrationBatch, onClose, updatePartyBulk]);

    // ①：画面が完全に閉じた時だけ、状態をリセットする（点滅バグの防止）
    React.useEffect(() => {
        if (!isOpen) {
            setFocusedSlot(null);
            setMigrationBatch(null);
        }
    }, [isOpen]);

    // Swipe-to-dismiss refs for mobile bottom sheet
    const dragStartY = useRef(0);
    const isDragging = useRef(false);

    const handleSheetTouchStart = (e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY;
        isDragging.current = true;
    };
    const handleSheetTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current || !popoverRef.current) return;
        const dy = e.touches[0].clientY - dragStartY.current;
        if (dy > 0) {
            popoverRef.current.style.transform = `translateY(${dy}px)`;
            popoverRef.current.style.transition = 'none';
        }
    };
    const handleSheetTouchEnd = () => {
        if (!isDragging.current || !popoverRef.current) return;
        isDragging.current = false;
        const dy = parseInt(popoverRef.current.style.transform.replace(/[^-?\d]/g, '') || '0');
        if (dy > 100) {
            handleAttemptClose();
        } else {
            popoverRef.current.style.transform = '';
            popoverRef.current.style.transition = 'all 0.3s cubic-bezier(0.2,0.8,0.2,1)';
        }
    };

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
        // Tutorial checks handled in SlotItem for simplicity or passed as flags
        setFocusedSlot(prev => prev === index ? null : index);
    }, []);

    const handleRemoveJob = React.useCallback((memberId: string) => {
        setDraftMembers(prev => prev.map(m => m.id === memberId ? { ...m, jobId: null as any } : m));
        setFocusedSlot(null);
    }, []);

    const handleMyJobToggle = React.useCallback((memberId: string, isMyJob: boolean) => {
        setMyMemberId(isMyJob ? null : memberId);
    }, [setMyMemberId]);

    const MELEE_IDS = ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'];
    const PHYS_RANGED_IDS = ['brd', 'mch', 'dnc'];

    // Core Hybrid Assignment Logic
    const handleJobSelect = (jobId: string) => {
        const job = JOBS.find(j => j.id === jobId);
        if (!job) return;

        // Tutorial: during slot sub-steps, block direct palette clicks / wrong job
        if (isTutorialSlots && tutorialSubStep < SLOT_TUTORIAL_SEQUENCE.length) {
            const sub = SLOT_TUTORIAL_SEQUENCE[tutorialSubStep];
            if (sub.type === 'slot') return;
            if (sub.type === 'job' && sub.jobId !== jobId) return;
        }
        // Tutorial: during palette step, only allow palette tutorial jobs
        if (isTutorialPalette && !PALETTE_TUTORIAL_JOBS.includes(jobId)) return;
        // Tutorial: block palette clicks during other steps
        if (isTutorialMyJob || isTutorialClose) return;

        let targetIndex: number | undefined = undefined;

        // Mode A: Manual Focus Override
        if (focusedSlot !== null && focusedSlot >= 0 && focusedSlot < 8) {
            targetIndex = focusedSlot;
            setDraftMembers(prev => prev.map((m, i) => i === targetIndex ? { ...m, jobId } : m));
        }
        // Mode B: Smart Auto Assign
        else {
            let preferredIndices: number[] = [];
            let swapData: { mtIdx: number, stIdx: number, newMtJob: string, newStJob: string } | null = null;

            if (job.role === 'tank') {
                // MT優先度: 暗黒(4) > 戦士(3) > ナイト(2) > ガンブレ(1)。ST優先度はその逆。
                const mtScore: Record<string, number> = { drk: 4, war: 3, pld: 2, gnb: 1 };
                const mtIdx = mtGroupIndices[0];
                const stIdx = stGroupIndices[0];
                const currentMtJob = draftMembers[mtIdx].jobId;
                const currentStJob = draftMembers[stIdx].jobId;

                const isMtPreferred = mtScore[jobId] >= 3; // 暗黒、戦士はMT希望

                if (!currentMtJob && !currentStJob) {
                    preferredIndices = isMtPreferred ? [mtIdx, stIdx] : [stIdx, mtIdx];
                } else if (currentMtJob && !currentStJob) {
                    if (mtScore[jobId] > mtScore[currentMtJob]) {
                        swapData = { mtIdx, stIdx, newMtJob: jobId, newStJob: currentMtJob };
                        targetIndex = mtIdx;
                    } else {
                        preferredIndices = [stIdx];
                    }
                } else if (!currentMtJob && currentStJob) {
                    if (mtScore[jobId] < mtScore[currentStJob]) {
                        swapData = { mtIdx, stIdx, newMtJob: currentStJob, newStJob: jobId };
                        targetIndex = stIdx;
                    } else {
                        preferredIndices = [mtIdx];
                    }
                } else {
                    preferredIndices = isMtPreferred ? [mtIdx] : [stIdx];
                }
            } else if (job.role === 'healer') {
                // PH(白,占)はH1、BH(学,賢)はH2
                if (['whm', 'ast'].includes(jobId)) {
                    preferredIndices = [mtGroupIndices[1], stGroupIndices[1]];
                } else {
                    preferredIndices = [stGroupIndices[1], mtGroupIndices[1]];
                }
            } else if (MELEE_IDS.includes(jobId)) {
                const d1 = mtGroupIndices[2];
                const d2 = stGroupIndices[2];
                const d1Occupied = !!draftMembers[d1].jobId;
                const d2Occupied = !!draftMembers[d2].jobId;
                if (!d1Occupied && !d2Occupied) {
                    preferredIndices = [d1, d2];
                } else if (!d1Occupied) {
                    preferredIndices = [d1];
                } else if (!d2Occupied) {
                    preferredIndices = [d2];
                } else {
                    const last = lastMeleeSlotRef.current;
                    targetIndex = last === d1 ? d2 : d1;
                    lastMeleeSlotRef.current = targetIndex;
                    setDraftMembers(prev => prev.map((m, i) => i === targetIndex ? { ...m, jobId } : m));
                }
            } else if (PHYS_RANGED_IDS.includes(jobId)) {
                preferredIndices = [mtGroupIndices[3], stGroupIndices[3]]; // D3 -> D4
            } else {
                preferredIndices = [stGroupIndices[3], mtGroupIndices[3]]; // D4 -> D3
            }

            if (swapData) {
                setDraftMembers(prev => {
                    const next = [...prev];
                    next[swapData!.mtIdx] = { ...next[swapData!.mtIdx], jobId: swapData!.newMtJob as any };
                    next[swapData!.stIdx] = { ...next[swapData!.stIdx], jobId: swapData!.newStJob as any };
                    return next;
                });
            } else {
                targetIndex = preferredIndices.find(idx => !draftMembers[idx].jobId);
                if (targetIndex === undefined) targetIndex = preferredIndices[0];
                setDraftMembers(prev => prev.map((m, i) => i === targetIndex ? { ...m, jobId } : m));
                if (MELEE_IDS.includes(jobId) && targetIndex !== undefined) {
                    lastMeleeSlotRef.current = targetIndex;
                }
            }
        }

        // オートスクロール（配置されたスロットへ滑らかに移動）
        if (targetIndex !== undefined) {
            setTimeout(() => {
                const el = document.getElementById(`party-slot-${targetIndex}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }, 50);
        }

        // Always unfocus after a selection attempt
        setFocusedSlot(null);

        // ── Tutorial sub-step advancement (additive only) ──
        if (isTutorialSlots && tutorialSubStep < SLOT_TUTORIAL_SEQUENCE.length) {
            const sub = SLOT_TUTORIAL_SEQUENCE[tutorialSubStep];
            if (sub.type === 'job' && sub.jobId === jobId) {
                const nextSub = tutorialSubStep + 1;
                setTutorialSubStep(nextSub);
                if (nextSub >= SLOT_TUTORIAL_SEQUENCE.length) {
                    useTutorialStore.getState().completeEvent('party:four-set');
                }
            }
        }
        if (isTutorialPalette) {
            const filled = draftMembers.filter(m => m.jobId).length;
            if (filled >= 7) {
                setTimeout(() => useTutorialStore.getState().completeEvent('party:all-set'), 300);
            }
        }
    };

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


    const renderJobPalette = () => {
        const categories = [
            { id: 'tank', name: 'Tank', jobs: JOBS.filter(j => j.role === 'tank'), color: 'hover:border-blue-500 hover:bg-blue-500/20' },
            { id: 'healer', name: 'Healer', jobs: JOBS.filter(j => j.role === 'healer'), color: 'hover:border-green-500 hover:bg-green-500/20' },
            { id: 'melee', name: 'Melee', jobs: JOBS.filter(j => MELEE_IDS.includes(j.id)), color: 'hover:border-red-500 hover:bg-red-500/20' },
            { id: 'ranged', name: 'Ranged', jobs: JOBS.filter(j => ['brd', 'mch', 'dnc'].includes(j.id)), color: 'hover:border-red-500 hover:bg-red-500/20' },
            { id: 'caster', name: 'Caster', jobs: JOBS.filter(j => ['blm', 'smn', 'rdm', 'pct'].includes(j.id)), color: 'hover:border-red-500 hover:bg-red-500/20' },
        ];

        return (
            // 👇 スマホ時にパレット全体がスクロールできるようにする
            <div className="flex flex-col gap-0.5 overflow-y-auto custom-scrollbar pr-1 pt-2 pb-2">
                {categories.map((cat, idx) => (
                    <React.Fragment key={cat.id}>
                        {idx !== 0 && <div className="h-[1px] bg-app-border w-full" />}
                        <div className="flex items-center gap-3">
                            <div className="w-12 text-right text-[9px] font-black text-white uppercase tracking-wider shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                {cat.name}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {cat.jobs.map(job => {
                                    const isTutorialTargetJob = isTutorialSlots
                                        && tutorialSubStep < SLOT_TUTORIAL_SEQUENCE.length
                                        && SLOT_TUTORIAL_SEQUENCE[tutorialSubStep].type === 'job'
                                        && SLOT_TUTORIAL_SEQUENCE[tutorialSubStep].jobId === job.id;

                                    const isAlreadyPlacedPaletteJob = isTutorialPalette && PALETTE_TUTORIAL_JOBS.includes(job.id) && draftMembers.some(m => m.jobId === job.id);
                                    const isTutorialPaletteTarget = isTutorialPalette && PALETTE_TUTORIAL_JOBS.includes(job.id) && !isAlreadyPlacedPaletteJob;

                                    return (
                                        <button
                                            key={job.id}
                                            data-tutorial={isTutorialTargetJob ? "party-slots-target" : isTutorialPaletteTarget ? "party-palette-target" : undefined}
                                            onClick={() => {
                                                if (isAlreadyPlacedPaletteJob) return;
                                                handleJobSelect(job.id);
                                            }}
                                            className={clsx(
                                                "btn-tactile w-9 h-9 rounded-lg border flex items-center justify-center relative group/btn",
                                                "bg-app-surface2 border-app-border hover:bg-app-surface2 hover:border-app-border",
                                                cat.color,
                                                isAlreadyPlacedPaletteJob ? "cursor-default" : "cursor-pointer"
                                            )}
                                        >
                                            {!isAlreadyPlacedPaletteJob && <Ripple />}
                                            <Tooltip content={job.name?.ja || ''}>
                                                <img src={job.icon} alt={job.name?.ja} className="w-6 h-6 object-contain transition-transform group-hover/btn:scale-110 relative z-10" />
                                            </Tooltip>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </React.Fragment>
                ))}
            </div>
        );
    };

    if (!mounted) return null;

    return createPortal(
        <div className={clsx(
            "fixed inset-0 z-[10000] flex",
            isOpen ? "pointer-events-auto" : "pointer-events-none"
        )}>
            {/* Backdrop */}
            <div
                className={clsx(
                    "absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ease-out",
                    isOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={handleAttemptClose}
            />

            {/* Slide-Over Panel — Left on PC, Bottom on Mobile */}
            <div
                ref={popoverRef}
                data-tutorial-modal
                data-tutorial="party-settings"
                className={clsx(
                    "relative flex flex-col glass-tier3 shadow-sm transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                    "md:h-full md:w-[450px] md:max-w-full md:border-r",
                    isOpen ? "md:translate-x-0" : "md:-translate-x-full",
                    // モバイル: ボトムナビ(3.5rem+safe-area)の上に配置
                    "max-md:fixed max-md:left-0 max-md:right-0 max-md:max-h-[70vh] max-md:rounded-t-2xl max-md:border-t",
                    isOpen ? "max-md:translate-y-0" : "max-md:translate-y-full"
                )}
                style={{ bottom: window.innerWidth < 768 ? 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' : undefined }}
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
                <div className="flex justify-between items-center px-5 py-4 border-b border-glass-border bg-glass-header flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-app-text/10 rounded-xl">
                            <User className="text-app-text" size={16} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-white tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{t('party.configuration_title')}</h2>
                            <p className="text-[10px] mt-0.5 font-bold">
                                {focusedSlot !== null
                                    ? <span className="flex items-center gap-1.5 text-app-text font-black">
                                        <span className="w-1.5 h-1.5 rounded-full bg-app-text animate-pulse inline-block" />
                                        {t('party.manual_mode_desc', { slot: partyMembers[focusedSlot].id })}
                                    </span>
                                    : <span className="text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] font-bold">{t('party.configuration_desc')}</span>
                                }
                            </p>
                        </div>
                    </div>
                    <button data-tutorial={isTutorialClose ? "party-settings-close-btn" : undefined} onClick={handleAttemptClose} className="p-1.5 rounded-lg text-app-text hover:text-white hover:bg-app-surface2 transition-colors cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {/* 上部セクション：8つのスロット（スクロール可能領域） */}
                <div className="flex-1 flex flex-col md:flex-col-reverse overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 pb-20 flex flex-col gap-6 bg-transparent">


                        {/* モバイル用インラインジョブ選択 */}
                        {focusedSlot !== null && typeof window !== 'undefined' && window.innerWidth < 768 && (
                            <div className="md:hidden bg-app-surface2/50 rounded-xl p-3 border border-app-border animate-in slide-in-from-bottom-2 duration-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black text-app-text-muted uppercase tracking-wider">
                                        {draftMembers[focusedSlot]?.id} — {t('party.select_job', 'ジョブを選択')}
                                    </span>
                                    <button onClick={() => setFocusedSlot(null)} className="text-app-text-muted p-1 cursor-pointer">
                                        <X size={14} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-6 gap-1.5">
                                    {JOBS.map(job => (
                                        <button
                                            key={job.id}
                                            onClick={() => {
                                                handleJobSelect(job.id);
                                                setFocusedSlot(null);
                                            }}
                                            className={clsx(
                                                "w-10 h-10 rounded-lg border flex items-center justify-center cursor-pointer active:scale-90 transition-all",
                                                draftMembers[focusedSlot]?.jobId === job.id
                                                    ? "bg-app-text/20 border-app-text"
                                                    : "bg-app-surface2 border-app-border"
                                            )}
                                        >
                                            <img src={job.icon} alt={job.name?.ja} className="w-7 h-7 object-contain" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* MTグループ */}
                        <div>
                            <div className="flex items-center justify-between mb-2 pl-1 pr-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-app-text"></span>
                                    <h3 className="text-white text-[11px] font-black tracking-widest uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">MT Group</h3>
                                </div>
                                <span className="text-[9px] text-white font-bold hidden md:inline-block drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
                                    {t('party.my_job_instruction_new')}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {mtGroupIndices.map(index => {
                                    const member = draftMembers[index];
                                    if (!member) return null;
                                    return (
                                        <SlotItem
                                            key={member.id}
                                            index={index}
                                            member={member}
                                            isFocused={focusedSlot === index}
                                            isMyJob={myMemberId === member.id}
                                            theme={theme}
                                            tutorialActive={tutorialActive}
                                            isTutorialSlots={isTutorialSlots}
                                            isTutorialPalette={isTutorialPalette}
                                            isTutorialMyJob={isTutorialMyJob}
                                            isTutorialClose={isTutorialClose}
                                            tutorialSubStep={tutorialSubStep}
                                            onFocusToggle={handleFocusToggle}
                                            onRemoveJob={handleRemoveJob}
                                            onMyJobToggle={handleMyJobToggle}
                                            setTutorialSubStep={setTutorialSubStep}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {/* STグループ */}
                        <div>
                            <div className="flex items-center gap-2 mb-2 pl-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-app-text"></span>
                                <h3 className="text-white text-[11px] font-black tracking-widest uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">ST Group</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {stGroupIndices.map(index => {
                                    const member = draftMembers[index];
                                    if (!member) return null;
                                    return (
                                        <SlotItem
                                            key={member.id}
                                            index={index}
                                            member={member}
                                            isFocused={focusedSlot === index}
                                            isMyJob={myMemberId === member.id}
                                            theme={theme}
                                            tutorialActive={tutorialActive}
                                            isTutorialSlots={isTutorialSlots}
                                            isTutorialPalette={isTutorialPalette}
                                            isTutorialMyJob={isTutorialMyJob}
                                            isTutorialClose={isTutorialClose}
                                            tutorialSubStep={tutorialSubStep}
                                            onFocusToggle={handleFocusToggle}
                                            onRemoveJob={handleRemoveJob}
                                            onMyJobToggle={handleMyJobToggle}
                                            setTutorialSubStep={setTutorialSubStep}
                                        />
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
            </div>

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
