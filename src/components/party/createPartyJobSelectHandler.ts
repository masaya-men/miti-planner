import type React from 'react';
import { useTutorialStore } from '../../store/useTutorialStore';
import type { Job, PartyMember } from '../../types';
import { mtGroupIndices, stGroupIndices, MELEE_IDS, PHYS_RANGED_IDS } from './partyJobGroups';

interface PartyJobSelectDeps {
    JOBS: Job[];
    focusedSlot: number | null;
    draftMembers: PartyMember[];
    setDraftMembers: React.Dispatch<React.SetStateAction<PartyMember[]>>;
    setFocusedSlot: React.Dispatch<React.SetStateAction<number | null>>;
    lastMeleeSlotRef: React.MutableRefObject<number>;
}

// Core Hybrid Assignment Logic
export const createPartyJobSelectHandler = ({ JOBS, focusedSlot, draftMembers, setDraftMembers, setFocusedSlot, lastMeleeSlotRef }: PartyJobSelectDeps) => (jobId: string) => {
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
                    next[swapData!.mtIdx] = { ...next[swapData!.mtIdx], jobId: swapData!.newMtJob };
                    next[swapData!.stIdx] = { ...next[swapData!.stIdx], jobId: swapData!.newStJob };
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

        // ── Tutorial: ジョブ配置イベント ──
        useTutorialStore.getState().completeEvent('party:job-set');

        // ジョブ配置後、配置済みジョブ数が2以上なら party:two-set を発火
        // NOTE: setDraftMembers は非同期なので、直前の変更を含めてカウントする
        setDraftMembers(prev => {
            const filledCount = prev.filter(m => m.jobId).length;
            if (filledCount >= 2) {
                useTutorialStore.getState().completeEvent('party:two-set');
            }
            return prev; // 状態は変更しない（カウントのみ）
        });

        // Always unfocus after a selection attempt
        setFocusedSlot(null);

    };
