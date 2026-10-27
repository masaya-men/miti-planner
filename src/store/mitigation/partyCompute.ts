import type { PartyMember, TimelineEvent, AppliedMitigation } from '../../types';
import { calculateMemberValues } from '../../utils/calculator';
import { buildScholarAutoInserts, hasAnyAetherflow } from '../../utils/scholarAutoInsert';
import { buildAstrologianAutoInserts, hasAnyAstrologianDraw } from '../../utils/astrologianAutoInsert';
import { getJobsFromStore, getMitigationsFromStore } from '../../hooks/useSkillsData';
import type { BatchOp } from '../../lib/collab/yjsPlanData';
import type { MitigationState } from './types';
import { DEFAULT_TANK_STATS, DEFAULT_HEALER_STATS } from './partyDefaults';

/** ジョブ変更計算で参照する store の最小スライス。 */
type PartyComputeSlice = Pick<MitigationState, 'partyMembers' | 'timelineMitigations' | 'timelineEvents' | 'currentLevel'>;

/** setMemberJob のソロ計算。ジョブ変更 + 当該メンバーの mitigations フィルタ/移行/学者・占星の自動挿入。 */
export function computeSetMemberJob(
    state: PartyComputeSlice,
    memberId: string,
    jobId: string | null,
): { partyMembers: PartyMember[]; timelineMitigations: AppliedMitigation[] } {
    const newMembers = state.partyMembers.map(m => {
        if (m.id === memberId) {
            const job = getJobsFromStore().find(j => j.id === jobId);
            const newRole = job ? job.role : m.role;
            let newStats = { ...m.stats };
            if (job && job.role !== m.role) {
                if (job.role === 'tank') newStats = { ...DEFAULT_TANK_STATS };
                else if (job.role === 'healer') newStats = { ...DEFAULT_HEALER_STATS };
                else newStats = { ...DEFAULT_HEALER_STATS };
            }
            const updatedMember = { ...m, jobId, role: newRole, stats: newStats };
            const computedValues = calculateMemberValues(updatedMember, state.currentLevel);
            return { ...updatedMember, computedValues };
        }
        return m;
    });

    const filteredMitigations = state.timelineMitigations.reduce<AppliedMitigation[]>((acc, mit) => {
        if (mit.ownerId !== memberId) { acc.push(mit); return acc; }
        const def = getMitigationsFromStore().find(m => m.id === mit.mitigationId);
        if (def?.jobId === jobId) { acc.push(mit); return acc; }
        if (def && def.jobId !== jobId) {
            const baseId = def.id.replace(`_${def.jobId}`, '');
            const newId = `${baseId}_${jobId}`;
            const newDef = getMitigationsFromStore().find(m => m.id === newId);
            if (newDef && newDef.jobId === jobId) { acc.push({ ...mit, mitigationId: newId }); return acc; }
        }
        return acc;
    }, []);

    if (jobId === 'sch' && !hasAnyAetherflow(memberId, filteredMitigations)) {
        filteredMitigations.push(...buildScholarAutoInserts(memberId, filteredMitigations, state.timelineEvents));
    }
    if (jobId === 'ast' && !hasAnyAstrologianDraw(memberId, filteredMitigations)) {
        filteredMitigations.push(...buildAstrologianAutoInserts(memberId, filteredMitigations, state.timelineEvents));
    }
    return { partyMembers: newMembers, timelineMitigations: filteredMitigations };
}

/** 1 メンバーのジョブ変更結果から batch ops を作る(partyMembers upsert + そのメンバーの mitigations 入替)。 */
export function memberJobBatchOps(
    prevMitigations: AppliedMitigation[],
    memberId: string,
    next: { partyMembers: PartyMember[]; timelineMitigations: AppliedMitigation[] },
): BatchOp[] {
    const changedMember = next.partyMembers.find(m => m.id === memberId);
    const oldIds = prevMitigations.filter(m => m.ownerId === memberId).map(m => m.id);
    const newMits = next.timelineMitigations.filter(m => m.ownerId === memberId);
    return [
        { kind: 'upsert', key: 'partyMembers', items: changedMember ? [changedMember] : [] },
        { kind: 'remove', key: 'timelineMitigations', ids: oldIds },
        { kind: 'upsert', key: 'timelineMitigations', items: newMits },
    ];
}

/** changeMemberJobWithMitigations のソロ計算。ジョブ変更 + 引数 mitigations で上書き + 学者/占星補完。 */
export function computeChangeMemberJobWithMitigations(
    state: PartyComputeSlice,
    memberId: string,
    jobId: string,
    mitis: AppliedMitigation[],
): { partyMembers: PartyMember[]; timelineMitigations: AppliedMitigation[] } {
    const newMembers = state.partyMembers.map(m => {
        if (m.id === memberId) {
            const job = getJobsFromStore().find(j => j.id === jobId);
            const newRole = job ? job.role : m.role;
            let newStats = { ...m.stats };
            if (job && job.role !== m.role) {
                if (job.role === 'tank') newStats = { ...DEFAULT_TANK_STATS };
                else if (job.role === 'healer') newStats = { ...DEFAULT_HEALER_STATS };
                else newStats = { ...DEFAULT_HEALER_STATS };
            }
            const updatedMember = { ...m, jobId, role: newRole, stats: newStats };
            return { ...updatedMember, computedValues: calculateMemberValues(updatedMember, state.currentLevel) };
        }
        return m;
    });

    const otherMitigations = state.timelineMitigations.filter(m => m.ownerId !== memberId);
    const finalMitis = [...mitis];
    if (jobId === 'sch') {
        const ownedMitis = finalMitis.map(m => ({ ...m, ownerId: memberId }));
        if (!hasAnyAetherflow(memberId, ownedMitis)) {
            finalMitis.push(...buildScholarAutoInserts(memberId, ownedMitis, state.timelineEvents));
        }
    }
    if (jobId === 'ast') {
        const ownedMitis = finalMitis.map(m => ({ ...m, ownerId: memberId }));
        if (!hasAnyAstrologianDraw(memberId, ownedMitis)) {
            finalMitis.push(...buildAstrologianAutoInserts(memberId, ownedMitis, state.timelineEvents));
        }
    }
    return { partyMembers: newMembers, timelineMitigations: [...otherMitigations, ...finalMitis] };
}

/** updatePartyBulk のソロ計算。複数メンバーのジョブ/mitigations を一括反映(履歴 1 回相当)。 */
export function computeUpdatePartyBulk(
    state: PartyComputeSlice,
    updates: { memberId: string; jobId: string | null; mitigations?: AppliedMitigation[] }[],
): { partyMembers: PartyMember[]; timelineMitigations: AppliedMitigation[] } {
    let currentMembers = [...state.partyMembers];
    let currentMitigations = [...state.timelineMitigations];

    updates.forEach(({ memberId, jobId, mitigations }) => {
        currentMembers = currentMembers.map(m => {
            if (m.id === memberId) {
                const job = getJobsFromStore().find(j => j.id === jobId);
                const newRole = job ? job.role : m.role;
                let newStats = { ...m.stats };
                if (job && job.role !== m.role) {
                    if (job.role === 'tank') newStats = { ...DEFAULT_TANK_STATS };
                    else if (job.role === 'healer') newStats = { ...DEFAULT_HEALER_STATS };
                    else newStats = { ...DEFAULT_HEALER_STATS };
                }
                const updatedMember = { ...m, jobId, role: newRole, stats: newStats };
                return { ...updatedMember, computedValues: calculateMemberValues(updatedMember, state.currentLevel) };
            }
            return m;
        });

        if (mitigations) {
            currentMitigations = currentMitigations.filter(mit => mit.ownerId !== memberId);
            currentMitigations = [...currentMitigations, ...mitigations];
        } else {
            const originalMember = state.partyMembers.find(m => m.id === memberId);
            if (originalMember && originalMember.jobId !== jobId) {
                currentMitigations = currentMitigations.reduce<AppliedMitigation[]>((acc, mit) => {
                    if (mit.ownerId !== memberId) { acc.push(mit); return acc; }
                    const def = getMitigationsFromStore().find(m => m.id === mit.mitigationId);
                    if (def?.jobId === jobId) { acc.push(mit); return acc; }
                    if (def && def.jobId !== jobId) {
                        const baseId = def.id.replace(`_${def.jobId}`, '');
                        const newId = `${baseId}_${jobId}`;
                        const newDef = getMitigationsFromStore().find(m => m.id === newId);
                        if (newDef && newDef.jobId === jobId) { acc.push({ ...mit, mitigationId: newId }); return acc; }
                    }
                    return acc;
                }, []);
            }
        }

        if (jobId === 'sch' && !hasAnyAetherflow(memberId, currentMitigations)) {
            currentMitigations.push(...buildScholarAutoInserts(memberId, currentMitigations, state.timelineEvents));
        }
        if (jobId === 'ast' && !hasAnyAstrologianDraw(memberId, currentMitigations)) {
            currentMitigations.push(...buildAstrologianAutoInserts(memberId, currentMitigations, state.timelineEvents));
        }
    });

    return { partyMembers: currentMembers, timelineMitigations: currentMitigations };
}

/** applyAutoPlan のソロ計算。最終 mitigations(学者/占星補完込み)と warning 更新後 events を返す。 */
export function computeApplyAutoPlan(
    state: Pick<MitigationState, 'partyMembers' | 'timelineEvents'>,
    mitigations: AppliedMitigation[],
    warnings: string[],
): { timelineMitigations: AppliedMitigation[]; timelineEvents: TimelineEvent[] } {
    const finalMitigations = [...mitigations];
    for (const member of state.partyMembers) {
        if (member.jobId === 'sch' && !hasAnyAetherflow(member.id, finalMitigations)) {
            finalMitigations.push(...buildScholarAutoInserts(member.id, finalMitigations, state.timelineEvents));
        }
        if (member.jobId === 'ast' && !hasAnyAstrologianDraw(member.id, finalMitigations)) {
            finalMitigations.push(...buildAstrologianAutoInserts(member.id, finalMitigations, state.timelineEvents));
        }
    }
    return {
        timelineMitigations: finalMitigations,
        timelineEvents: state.timelineEvents.map(e => ({ ...e, warning: warnings.includes(e.id) })),
    };
}
