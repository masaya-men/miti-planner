import type { AppliedMitigation, Mitigation } from '../types';
import { useMitigationStore } from '../store/useMitigationStore';
import { MITIGATIONS } from '../data/mockData';

export const generateAutoPlan = (): void => {
    const store = useMitigationStore.getState();
    const { timelineEvents, partyMembers } = store;

    // Filter events that actually deal damage
    const damageEvents = timelineEvents
        .filter(e => e.damageAmount && e.damageAmount > 0)
        .sort((a, b) => a.time - b.time);

    if (damageEvents.length === 0) return;

    // We will build a list of new mitigations to add
    const newMitigations: AppliedMitigation[] = [];

    // Track cooldowns for each mitigation instance by member
    // Key: `${memberId}_${mitigationId}`, Value: End time of last use + recast
    const cooldowns = new Map<string, number>();

    const isAvailable = (memberId: string, mitId: string, time: number): boolean => {
        const cdEnd = cooldowns.get(`${memberId}_${mitId}`) || 0;
        return time >= cdEnd;
    };

    const useSkill = (memberId: string, mitDef: Mitigation, time: number): AppliedMitigation => {
        const recastTime = mitDef.recast || 0;
        cooldowns.set(`${memberId}_${mitDef.id}`, time + mitDef.duration + recastTime);
        return {
            id: crypto.randomUUID(),
            mitigationId: mitDef.id,
            ownerId: memberId,
            time: Math.max(0, time - 3), // Apply 3 seconds before damage
            duration: mitDef.duration
        };
    };

    // Find available party mitigations for a member
    const getAvailablePartyMit = (memberId: string, time: number, excludeShields: boolean = false): Mitigation | null => {
        const member = partyMembers.find(m => m.id === memberId);
        if (!member || !member.jobId) return null;

        const jobSkills = MITIGATIONS.filter(m => m.jobId === member.jobId && m.scope === 'party');
        const roleSkills = MITIGATIONS.filter(m => m.jobId === member.role && m.scope === 'party');
        const allSkills = [...jobSkills, ...roleSkills];

        for (const skill of allSkills) {
            if (excludeShields && skill.isShield) continue;
            if (isAvailable(memberId, skill.id, time)) {
                return skill;
            }
        }
        return null;
    };

    // Main heuristic loop
    // Rules: MT Group casts first. If MT Group has nothing, ST Group casts.
    damageEvents.forEach(event => {
        const time = event.time;

        // Skip non-party damage for now in this simple auto-planner
        if (event.target !== 'AoE' && event.target !== undefined) return;

        let utilized = false;

        // 1. Try MT Group
        const mtGroup = ['MT', 'H1', 'D1', 'D3'];
        for (const memberId of mtGroup) {
            const skill = getAvailablePartyMit(memberId, time, true); // Prioritize pure percent mit over shields first
            if (skill) {
                newMitigations.push(useSkill(memberId, skill, time));
                utilized = true;
                break;
            }
        }

        if (utilized) return;

        // 2. Try ST Group
        const stGroup = ['ST', 'H2', 'D2', 'D4'];
        for (const memberId of stGroup) {
            const skill = getAvailablePartyMit(memberId, time, true);
            if (skill) {
                newMitigations.push(useSkill(memberId, skill, time));
                utilized = true;
                break;
            }
        }

        if (utilized) return;

        // 3. Last fallback: try any shield
        const allMembers = [...mtGroup, ...stGroup];
        for (const memberId of allMembers) {
            const skill = getAvailablePartyMit(memberId, time, false);
            if (skill) {
                newMitigations.push(useSkill(memberId, skill, time));
                break;
            }
        }
    });

    // Add them to the store
    newMitigations.forEach(store.addMitigation);
};
