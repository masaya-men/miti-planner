import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMitigationStore } from '../store/useMitigationStore';
import { JOBS } from '../data/mockData';
import { User, Trash2, Star, X } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { JobMigrationModal } from './JobMigrationModal';
import { migrateMitigations } from '../utils/jobMigration';
import { Ripple } from './Ripple';
import { useTutorialStore, TUTORIAL_STEPS } from '../store/useTutorialStore';
import type { MigrationMode } from '../utils/jobMigration';
import type { Job, PartyMember } from '../types';

interface PartySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PartySettingsModal: React.FC<PartySettingsModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { partyMembers, setMemberJob, timelineMitigations, myMemberId, setMyMemberId } = useMitigationStore();
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

    // Sub-step sequence for Step 3 (slot-click method)
    const SLOT_TUTORIAL_SEQUENCE: { type: 'slot' | 'job'; slotIndex?: number; jobId?: string }[] = [
        { type: 'slot', slotIndex: 0 }, { type: 'job', jobId: 'drk' },
        { type: 'slot', slotIndex: 2 }, { type: 'job', jobId: 'whm' },
        { type: 'slot', slotIndex: 4 }, { type: 'job', jobId: 'mnk' },
        { type: 'slot', slotIndex: 6 }, { type: 'job', jobId: 'dnc' },
    ];
    // Step 4 palette jobs
    const PALETTE_TUTORIAL_JOBS = ['pld', 'sch', 'drg', 'blm'];

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
            safeChanges.forEach(change => {
                setMemberJob(change.memberId, change.jobId as any);
            });
            // ── Tutorial: Complete Step 5 ──
            useTutorialStore.getState().completeEvent('party-settings:closed');
            onClose();
        } else {
            // Unsafe changes
            setMigrationBatch(pendingMigrations);
        }
    }, [partyMembers, draftMembers, timelineMitigations, migrationBatch, onClose, setMemberJob]);

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

    // ②：背景クリックとEscapeキーの検知（お掃除コードから状態リセットを削除）
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
            // リスナーの解除のみ行い、状態のリセットは行わない
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleAttemptClose]);

    // Absolute Rules - DO NOT MODIFY
    const mtGroupIndices = [0, 2, 4, 6];
    const stGroupIndices = [1, 3, 5, 7];

    const handleRemoveJob = (memberId: string) => {
        setDraftMembers(prev => prev.map(m => m.id === memberId ? { ...m, jobId: null as any } : m));
    };

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

        // Apply any safe changes first
        draftMembers.forEach(draftMember => {
            const originalMember = partyMembers.find(m => m.id === draftMember.id);
            if (originalMember && originalMember.jobId !== draftMember.jobId && !migrationBatch.some(b => b.memberId === draftMember.id)) {
                setMemberJob(draftMember.id, draftMember.jobId as any);
            }
        });

        migrationBatch.forEach(({ memberId, oldJob, newJob }) => {
            const memberMitis = useMitigationStore.getState().timelineMitigations.filter(m => m.ownerId === memberId);
            const newMitis = migrateMitigations(oldJob?.id || '', newJob.id, memberId, memberMitis, mode);
            useMitigationStore.getState().changeMemberJobWithMitigations(memberId, newJob.id, newMitis);
        });

        setMigrationBatch(null);
        onClose();
    };

    const handleBatchMigrationCancel = () => {
        setMigrationBatch(null);
    };

    // --- UI Rendering Helpers ---

    const renderSlot = (index: number) => {
        const member = draftMembers[index];
        if (!member) return null;
        const job = JOBS.find(j => j.id === member.jobId);
        const isFocused = focusedSlot === index;
        const isMyJob = myMemberId === member.id;

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
                key={member.id}
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
                    setFocusedSlot(isFocused ? null : index);
                    // Tutorial: advance sub-step when correct slot is clicked
                    if (isTutorialSlots && tutorialSubStep < SLOT_TUTORIAL_SEQUENCE.length) {
                        const sub = SLOT_TUTORIAL_SEQUENCE[tutorialSubStep];
                        if (sub.type === 'slot' && sub.slotIndex === index && !isFocused) {
                            setTutorialSubStep(prev => prev + 1);
                        }
                    }
                }}
                className={clsx(
                    "btn-tactile h-14 rounded-xl flex items-center justify-between px-3 cursor-pointer border relative group/slot",
                    isFocused
                        ? "bg-app-accent-dim border-app-border-accent shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                        : job
                            ? "bg-slate-800/40 border-white/10 hover:bg-slate-800/60 hover:border-white/20"
                            : "bg-white/[0.02] border-white/5 hover:bg-white/10 border-dashed"
                )}
            >
                {/* Background Gradient */}
                {job && (
                    <div className={clsx("absolute inset-0 opacity-20 pointer-events-none transition-opacity group-hover/slot:opacity-30",
                        activeColor === 'blue' ? 'bg-gradient-to-r from-blue-500/50 to-transparent' :
                            activeColor === 'green' ? 'bg-gradient-to-r from-green-500/50 to-transparent' :
                                'bg-gradient-to-r from-red-500/50 to-transparent'
                    )} />
                )}

                <Ripple />

                {/* Left side: Tag and Icon */}
                <div className="flex items-center gap-3 z-10 pointer-events-none">
                    <div className={clsx("text-xs font-black tracking-widest w-6",
                        activeColor === 'blue' ? 'text-blue-400' :
                            activeColor === 'green' ? 'text-green-400' : 'text-red-400'
                    )}>
                        {member.id}
                    </div>
                    {job ? (
                        <img src={job.icon} alt={job.name?.ja} className="w-8 h-8 object-contain drop-shadow-md" />
                    ) : (
                        <div className="w-8 h-8 rounded-full border border-white/10 bg-black/20 flex flex-col items-center justify-center">
                            <span className="text-[8px] text-white/30 font-bold uppercase tracking-widest">Select</span>
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
                                    setMyMemberId(isMyJob ? null : member.id);

                                    if (isTutorialMyJob && member.id === 'ST') {
                                        useTutorialStore.getState().completeEvent('my-job:set');
                                    }
                                }}
                                className={clsx("px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center gap-1 border",
                                    isMyJob
                                        ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.3)]"
                                        : "bg-black/40 text-white/40 border-transparent hover:bg-black/60 hover:text-white/80"
                                )}
                                title="Set as My Job"
                            >
                                {isMyJob && <Star size={10} className="fill-yellow-400" />}<span className="hidden md:inline"> My Job</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isTutorialSlots || isTutorialPalette || isTutorialMyJob || isTutorialClose) return;
                                    handleRemoveJob(member.id);
                                    if (isFocused) setFocusedSlot(null);
                                }}
                                // 👇 変更：スマホでも常に表示され、少し大きく押しやすいように調整
                                className="p-2 rounded-lg bg-red-500/10 text-red-400/80 hover:bg-red-500/20 hover:text-red-400 transition-colors md:opacity-0 group-hover/slot:md:opacity-100 flex items-center justify-center ml-1"
                                title="Remove Job"
                            >
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
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
            // 👇 スマホ時にパレット全体がスクロールできるようにし、下部に十分な余白(pb-12)を持たせる
            <div className="flex flex-col gap-0.5 overflow-y-auto custom-scrollbar pr-1 pb-4">
                {categories.map((cat, idx) => (
                    <React.Fragment key={cat.id}>
                        {idx !== 0 && <div className="h-[1px] bg-white/[0.05] w-full" />}
                        <div className="flex items-center gap-3">
                            <div className="w-12 text-right text-[9px] font-bold text-app-text-muted uppercase tracking-wider shrink-0">
                                {cat.name}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {cat.jobs.map(job => {
                                    const isTutorialTargetJob = isTutorialSlots
                                        && tutorialSubStep < SLOT_TUTORIAL_SEQUENCE.length
                                        && SLOT_TUTORIAL_SEQUENCE[tutorialSubStep].type === 'job'
                                        && SLOT_TUTORIAL_SEQUENCE[tutorialSubStep].jobId === job.id;

                                    const isTutorialPaletteTarget = isTutorialPalette && PALETTE_TUTORIAL_JOBS.includes(job.id);

                                    return (
                                        <button
                                            key={job.id}
                                            data-tutorial={isTutorialTargetJob ? "party-slots-target" : isTutorialPaletteTarget ? "party-palette-target" : undefined}
                                            onClick={() => handleJobSelect(job.id)}
                                            className={clsx(
                                                "btn-tactile w-9 h-9 rounded-lg border bg-black/40 flex items-center justify-center relative group/btn",
                                                `border-white/10 cursor-pointer ${cat.color}`
                                            )}
                                            title={job.name?.ja}
                                        >
                                            <Ripple />
                                            <img src={job.icon} alt={job.name?.ja} className="w-6 h-6 object-contain transition-transform group-hover/btn:scale-110 relative z-10" />
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
        <div data-tutorial-modal className={clsx(
            "fixed inset-0 z-[10000] flex",
            isOpen ? "pointer-events-auto" : "pointer-events-none"
        )}>
            {/* Backdrop */}
            <div
                data-tutorial={isTutorialClose ? "party-settings-close-btn" : undefined}
                className={clsx(
                    "absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ease-out",
                    isOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={handleAttemptClose}
            />

            {/* Slide-Over Panel — Left on PC, Bottom on Mobile */}
            <div
                ref={popoverRef}
                data-tutorial="party-settings"
                className={clsx(
                    "relative flex flex-col glass-panel shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                    "md:h-full md:w-[450px] md:max-w-full md:border-r",
                    isOpen ? "md:translate-x-0" : "md:-translate-x-full",
                    // 👇 変更：スマホ時の高さ上限を 85vh に広げる
                    "max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:max-h-[85vh] max-md:rounded-t-2xl max-md:border-t",
                    isOpen ? "max-md:translate-y-0" : "max-md:translate-y-full"
                )}
            >
                {/* Mobile drag handle */}
                <div
                    className="md:hidden flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing"
                    onTouchStart={handleSheetTouchStart}
                    onTouchMove={handleSheetTouchMove}
                    onTouchEnd={handleSheetTouchEnd}
                >
                    <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>

                {/* ヘッダーエリア */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-glass-border bg-white/40 dark:bg-slate-900/30 backdrop-blur-xl flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <User className="text-blue-500" size={16} />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold text-app-text tracking-wider">{t('party.configuration_title')}</h2>
                            <p className="text-[9px] text-app-text-muted mt-0.5">
                                {t('party.configuration_desc')}
                            </p>
                        </div>
                    </div>
                    <button data-tutorial={isTutorialClose ? "party-settings-close-btn" : undefined} onClick={handleAttemptClose} className="p-1.5 rounded-lg text-app-text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {/* 上部セクション：8つのスロット（スクロール可能領域） */}
                <div className="flex-1 flex flex-col md:flex-col-reverse overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 pb-20 flex flex-col gap-6 bg-transparent">

                        {/* Status Info Box inside scroll area, just above groups */}
                        {focusedSlot !== null && (
                            <div className="w-full p-2.5 rounded-lg border bg-app-accent-dim/20 border-app-border-accent flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                                <span className="text-[11px] text-sky-200">
                                    <strong>{t('party.manual_mode')}</strong> {t('party.manual_mode_desc', { slot: partyMembers[focusedSlot].id })}
                                </span>
                            </div>
                        )}

                        {/* MTグループ */}
                        <div>
                            <div className="flex items-center gap-2 mb-2 pl-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]"></span>
                                <h3 className="text-slate-800 dark:text-blue-200/90 text-[11px] font-bold tracking-widest">MT GROUP</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {/* h-14 の大きなスロットを4つ並べる (MT, H1, D1, D3) */}
                                {mtGroupIndices.map(renderSlot)}
                            </div>
                        </div>

                        {/* STグループ */}
                        <div>
                            <div className="flex items-center gap-2 mb-2 pl-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.6)]"></span>
                                <h3 className="text-slate-800 dark:text-purple-200/90 text-[11px] font-bold tracking-widest">ST GROUP</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {/* h-14 の大きなスロットを4つ並べる (ST, H2, D2, D4) */}
                                {stGroupIndices.map(renderSlot)}
                            </div>
                        </div>
                    </div>

                    {/* ── Tutorial Banner removed to use unified TutorialOverlay ── */}

                    <div data-tutorial="job-palette" className="h-auto bg-white/50 dark:bg-slate-900/40 backdrop-blur-2xl border-t border-b-0 md:border-b md:border-t-0 border-glass-border p-3 pb-3 flex flex-col gap-0.5 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] md:shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-10">
                        <h3 className="text-slate-600 dark:text-slate-300 text-[10px] font-bold tracking-widest mb-1.5">{t('party.job_palette')}</h3>
                        {/* ここにのみ、全ジョブのアイコンをロールごとにまとめて表示する */}
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
