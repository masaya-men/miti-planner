import React, { useState } from 'react';
import { useMitigationStore } from '../store/useMitigationStore';
import { JOBS } from '../data/mockData';
import { User, Trash2, Star } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { JobMigrationModal } from './JobMigrationModal';
import { migrateMitigations } from '../utils/jobMigration';
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
                preferredIndices = [mtGroupIndices[2], stGroupIndices[2]]; // D1 -> D2
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

        return (
            <div
                key={member.id}
                id={`party-slot-${index}`}
                onClick={() => setFocusedSlot(isFocused ? null : index)}
                className={clsx(
                    "h-14 rounded-xl flex items-center justify-between px-3 cursor-pointer transition-all duration-200 border relative overflow-hidden group/slot",
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

                {/* Left side: Tag and Icon */}
                <div className="flex items-center gap-3 z-10 pointer-events-none">
                    <div className={clsx("text-xs font-black tracking-widest w-6",
                        activeColor === 'blue' ? 'text-blue-400' :
                            activeColor === 'green' ? 'text-green-400' : 'text-red-400'
                    )}>
                        {member.id}
                    </div>
                    {job ? (
                        <img src={job.icon} alt={job.name} className="w-8 h-8 object-contain drop-shadow-md" />
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
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMyMemberId(isMyJob ? null : member.id);
                                }}
                                className={clsx("px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center gap-1 border",
                                    isMyJob
                                        ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.3)]"
                                        : "bg-black/40 text-white/40 border-transparent hover:bg-black/60 hover:text-white/80"
                                )}
                                title="Set as My Job"
                            >
                                {isMyJob && <Star size={10} className="fill-yellow-400" />} My Job
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveJob(member.id);
                                    if (isFocused) setFocusedSlot(null);
                                }}
                                className="p-1.5 rounded-lg bg-black/40 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-colors opacity-0 group-hover/slot:opacity-100 focus:opacity-100"
                                title="Remove Job"
                            >
                                <Trash2 size={14} />
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
            <div className="flex flex-col gap-1">
                {categories.map((cat, idx) => (
                    <React.Fragment key={cat.id}>
                        {idx !== 0 && <div className="h-[1px] bg-white/[0.05] w-full" />}
                        <div className="flex items-center gap-3">
                            <div className="w-12 text-right text-[9px] font-bold text-app-text-muted uppercase tracking-wider shrink-0">
                                {cat.name}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {cat.jobs.map(job => {
                                    return (
                                        <button
                                            key={job.id}
                                            onClick={() => handleJobSelect(job.id)}
                                            className={clsx(
                                                "w-9 h-9 rounded-lg border bg-black/40 flex items-center justify-center transition-all relative overflow-hidden group/btn",
                                                `border-white/10 cursor-pointer ${cat.color} hover:shadow-lg hover:border-white/20`
                                            )}
                                            title={job.name}
                                        >
                                            <img src={job.icon} alt={job.name} className="w-6 h-6 object-contain transition-transform group-hover/btn:scale-110" />
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

    return (
        <div className={clsx(
            "fixed inset-0 z-[9999] flex",
            isOpen ? "pointer-events-auto" : "pointer-events-none"
        )}>
            {/* Backdrop */}
            <div
                className={clsx(
                    "absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ease-out",
                    isOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={handleAttemptClose}
            />

            {/* Slide-Over Panel (Left) using User's skeleton structure exactly */}
            <div
                ref={popoverRef}
                className={clsx(
                    "relative h-full w-[450px] max-w-full flex flex-col bg-glass-panel backdrop-blur-xl border-r border-glass-border shadow-2xl transition-transform duration-300 ease-out",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* ヘッダーエリア */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-glass-border bg-glass-header flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <User className="text-blue-500" size={16} />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold text-app-text tracking-wider">{t('party.configuration_title', 'パーティ編成')}</h2>
                            <p className="text-[9px] text-app-text-muted mt-0.5">
                                スロットをクリックしてフォーカス固定するか、そのままジョブを選んで自動配置します
                            </p>
                        </div>
                    </div>
                    <button onClick={handleAttemptClose} className="px-4 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg text-xs font-bold transition-colors">
                        Close
                    </button>
                </div>

                {/* 上部セクション：8つのスロット（スクロール可能領域） */}
                <div className="flex-1 flex flex-col md:flex-col-reverse overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 bg-[#020203]/40">

                        {/* Status Info Box inside scroll area, just above groups */}
                        {focusedSlot !== null && (
                            <div className="w-full p-2.5 rounded-lg border bg-app-accent-dim/20 border-app-border-accent flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                                <span className="text-[11px] text-sky-200">
                                    <strong>マニュアルモード:</strong> 次に選んだジョブは <strong>{partyMembers[focusedSlot].id}</strong> に強制配置されます。
                                </span>
                            </div>
                        )}

                        {/* MTグループ */}
                        <div>
                            <h3 className="text-app-text-muted text-xs font-bold mb-2 tracking-widest pl-1">MT GROUP</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {/* h-14 の大きなスロットを4つ並べる (MT, H1, D1, D3) */}
                                {mtGroupIndices.map(renderSlot)}
                            </div>
                        </div>

                        {/* STグループ */}
                        <div>
                            <h3 className="text-app-text-muted text-xs font-bold mb-2 tracking-widest pl-1">ST GROUP</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {/* h-14 の大きなスロットを4つ並べる (ST, H2, D2, D4) */}
                                {stGroupIndices.map(renderSlot)}
                            </div>
                        </div>
                    </div>

                    {/* 下部セクション：共通ジョブパレット（画面下部に固定配置） */}
                    <div className="h-auto max-h-[45vh] bg-glass-card border-t border-b-0 md:border-b md:border-t-0 border-glass-border p-3 flex flex-col gap-1.5 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] md:shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-10">
                        <h3 className="text-app-text-muted text-[10px] font-bold tracking-widest mb-1.5">JOB PALETTE (タップして配置)</h3>
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
        </div>
    );
};
