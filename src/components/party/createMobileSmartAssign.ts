import type React from 'react';
import { useMitigationStore } from '../../store/useMitigationStore';
import type { Job } from '../../types';

type PartyMember = ReturnType<typeof useMitigationStore.getState>['partyMembers'][number];

interface MobileSmartAssignDeps {
    JOBS: Job[];
    focusedSlot: string | null;
    sortedMembers: PartyMember[];
    setMemberJob: (memberId: string, jobId: string) => void;
    handleJobChange: (memberId: string, jobId: string) => void;
    lastMeleeSlotRef: React.MutableRefObject<string | null>;
}

    const MELEE_IDS = ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'];
    const PHYS_RANGED_IDS = ['brd', 'mch', 'dnc'];

export const createMobileSmartAssign = ({ JOBS, focusedSlot, sortedMembers, setMemberJob, handleJobChange, lastMeleeSlotRef }: MobileSmartAssignDeps) => (jobId: string) => {
        const job = JOBS.find(j => j.id === jobId);
        if (!job) return;

        // Mode A: フォーカス中のスロットに直接配置
        if (focusedSlot) {
            handleJobChange(focusedSlot, jobId);
            return;
        }

        // Mode B: スマート配置（PC版と同じロジック）
        let targetId: string | undefined;

        if (job.role === 'tank') {
            const mtScore: Record<string, number> = { drk: 4, war: 3, pld: 2, gnb: 1 };
            const mtMember = sortedMembers.find(m => m.id === 'MT')!;
            const stMember = sortedMembers.find(m => m.id === 'ST')!;
            const currentMtJob = mtMember.jobId;
            const currentStJob = stMember.jobId;
            const isMtPreferred = (mtScore[jobId] ?? 0) >= 3;

            if (!currentMtJob && !currentStJob) {
                targetId = isMtPreferred ? 'MT' : 'ST';
            } else if (currentMtJob && !currentStJob) {
                if ((mtScore[jobId] ?? 0) > (mtScore[currentMtJob] ?? 0)) {
                    // 新ジョブの方がMT適性が高い → 現MTをSTに押し出してMTに配置
                    setMemberJob('ST', currentMtJob);
                    targetId = 'MT';
                } else {
                    targetId = 'ST';
                }
            } else if (!currentMtJob && currentStJob) {
                if ((mtScore[jobId] ?? 0) < (mtScore[currentStJob] ?? 0)) {
                    // 現STの方がMT適性が高い → 現STをMTに移動、新ジョブをSTに
                    setMemberJob('MT', currentStJob);
                    targetId = 'ST';
                } else {
                    targetId = 'MT';
                }
            } else {
                targetId = isMtPreferred ? 'MT' : 'ST';
            }
        } else if (job.role === 'healer') {
            const preferred = ['whm', 'ast'].includes(jobId)
                ? ['H1', 'H2'] : ['H2', 'H1'];
            targetId = preferred.find(id => !sortedMembers.find(m => m.id === id)?.jobId)
                ?? preferred[0];
        } else if (MELEE_IDS.includes(jobId)) {
            const d1 = sortedMembers.find(m => m.id === 'D1')!;
            const d2 = sortedMembers.find(m => m.id === 'D2')!;
            if (!d1.jobId && !d2.jobId) {
                targetId = 'D1';
            } else if (!d1.jobId) {
                targetId = 'D1';
            } else if (!d2.jobId) {
                targetId = 'D2';
            } else {
                targetId = lastMeleeSlotRef.current === 'D1' ? 'D2' : 'D1';
            }
            lastMeleeSlotRef.current = targetId;
        } else if (PHYS_RANGED_IDS.includes(jobId)) {
            targetId = !sortedMembers.find(m => m.id === 'D3')?.jobId ? 'D3'
                : !sortedMembers.find(m => m.id === 'D4')?.jobId ? 'D4' : 'D3';
        } else {
            // キャスター
            targetId = !sortedMembers.find(m => m.id === 'D4')?.jobId ? 'D4'
                : !sortedMembers.find(m => m.id === 'D3')?.jobId ? 'D3' : 'D4';
        }

        if (targetId) {
            handleJobChange(targetId, jobId);
        }
};
