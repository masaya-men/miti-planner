import type { TimelineEvent, PartyMember, AppliedMitigation, Mitigation } from '../types';
import { MITIGATIONS } from '../data/mockData';

// -----------------------------------------------------------------------------
// FF14 Mitigation Auto-Planner Engine V4 (Priority / 2-Pass Scheduling)
// -----------------------------------------------------------------------------

const EXCLUDED_MITIGATIONS = new Set(['passage_of_arms']);

const GROUP1_ROLES = ['MT', 'H1', 'D1', 'D3'];
const GROUP2_ROLES = ['ST', 'H2', 'D2', 'D4'];

const DERIVED_SKILLS_MAP: Record<string, string> = {
    'neutral_sect': 'sun_sign',
    'temperance': 'divine_caress'
};

function getMitigation(id: string): Mitigation | undefined {
    return MITIGATIONS.find(m => m.id === id);
}

function getFamily(miti: Mitigation): string {
    const nameEn = miti.nameEn || miti.name || '';
    if (['Tactician', 'Troubadour', 'Shield Samba'].some(m => nameEn.includes(m))) return 'RangedMiti';
    if (nameEn.includes('Reprisal')) return 'Reprisal';
    if (nameEn.includes('Feint')) return 'Feint';
    if (nameEn.includes('Addle')) return 'Addle';
    return miti.id;
}

export function generateAutoPlan(
    timeline: TimelineEvent[],
    party: PartyMember[],
): AppliedMitigation[] {
    const assignments: AppliedMitigation[] = [];

    const memberMitigations = new Map<string, Mitigation[]>();
    for (const member of party) {
        if (member.jobId) {
            memberMitigations.set(member.id, MITIGATIONS.filter(m =>
                (m.jobId === member.jobId || m.jobId === member.role) &&
                !EXCLUDED_MITIGATIONS.has(m.id)
            ));
        }
    }

    // Step 2: Recast Interval Management (Collision check)
    // Tracks usage times of each mitigation for each member: memberId_mitiId -> number[]
    const usageTimes = new Map<string, number[]>();

    const isCooldownAvailable = (memberId: string, mitiId: string, time: number): boolean => {
        const miti = getMitigation(mitiId);
        if (!miti) return false;

        const memberMitis = memberMitigations.get(memberId) || [];
        if (!memberMitis.some(m => m.id === mitiId)) return false;

        // 1. Cooldown interval check
        const key = `${memberId}_${mitiId}`;
        const times = usageTimes.get(key) || [];
        for (const usedTime of times) {
            if (Math.abs(time - usedTime) < miti.cooldown) {
                return false;
            }
        }

        // 2. Exact same time overlapping family check
        const family = getFamily(miti);
        const hasFamilyOverlap = assignments.some(a => {
            const aMiti = getMitigation(a.mitigationId);
            if (!aMiti || getFamily(aMiti) !== family) return false;
            return (time < a.time + a.duration) && (a.time < time + miti.duration);
        });

        if (hasFamilyOverlap) return false;

        return true;
    };

    const useMitigation = (memberId: string, mitiId: string, time: number) => {
        const miti = getMitigation(mitiId);
        if (!miti) return;

        assignments.push({
            id: crypto.randomUUID(),
            mitigationId: miti.id,
            time: time,
            duration: miti.duration,
            ownerId: memberId,
        });

        const key = `${memberId}_${mitiId}`;
        const times = usageTimes.get(key) || [];
        times.push(time);
        usageTimes.set(key, times);

        // Step 5: Derived Skills Auto-Placement
        if (DERIVED_SKILLS_MAP[miti.id]) {
            const derivedId = DERIVED_SKILLS_MAP[miti.id];
            const dMiti = getMitigation(derivedId);
            if (dMiti) {
                assignments.push({
                    id: crypto.randomUUID(),
                    mitigationId: dMiti.id,
                    time: time,
                    duration: dMiti.duration,
                    ownerId: memberId,
                });
                const dKey = `${memberId}_${derivedId}`;
                const dTimes = usageTimes.get(dKey) || [];
                dTimes.push(time);
                usageTimes.set(dKey, dTimes);
            }
        }
    };

    // Step 1: Data Preparation and Sorting
    const damageEvents = timeline.filter(t => (t.target === 'AoE' || t.target === 'MT' || t.target === 'ST') && (t.damageAmount || 0) > 0);
    const aoeEvents = damageEvents.filter(t => t.target === 'AoE');
    const tbEvents = damageEvents.filter(t => t.target === 'MT' || t.target === 'ST');

    const maxAoeDamage = aoeEvents.reduce((max, ev) => Math.max(max, ev.damageAmount || 0), 0);
    const maxTbDamage = tbEvents.reduce((max, ev) => Math.max(max, ev.damageAmount || 0), 0);

    const extremeAoeThreshold = maxAoeDamage * 0.8;
    const extremeTbThreshold = maxTbDamage * 0.8;

    // Queue of all damage events sorted descending by raw damage
    const sortedEvents = [...damageEvents].sort((a, b) => (b.damageAmount || 0) - (a.damageAmount || 0));

    const tankSkills = {
        pld: { invuln: 'hallowed_ground', heavy: 'guardian', mid: 'bulwark', short: 'holy_sheltron' },
        war: { invuln: 'holmgang', heavy: 'damnation', mid: 'thrill_of_battle', short: 'bloodwhetting' },
        drk: { invuln: 'living_dead', heavy: 'shadowed_vigil', mid: 'dark_mind', short: 'the_blackest_night' },
        gnb: { invuln: 'superbolide', heavy: 'great_nebula', mid: 'camouflage', short: 'heart_of_corundum' },
    };

    const h2 = party.find(m => m.id === 'H2');
    const getBhSets = (jobId: string) => {
        if (jobId === 'sch') return { setA: ['sacred_soil', 'fey_illumination', 'summon_seraph'], setB: ['sacred_soil', 'recitation_deployment_tactics'], setC: ['sacred_soil', 'expedient'], short: 'sacred_soil' };
        if (jobId === 'sge') return { setA: ['kerachole', 'holos'], setB: ['kerachole', 'panhaima'], setC: ['kerachole', 'philosophia'], short: 'kerachole' };
        return null;
    };
    const bhSets = h2?.jobId ? getBhSets(h2.jobId) : null;

    const tryRoleMitis = (roleIds: string[], time: number) => {
        for (const roleId of roleIds) {
            const member = party.find(m => m.id === roleId);
            if (!member || !member.jobId) continue;
            const partyMitis = (memberMitigations.get(roleId) || []).filter(m => m.scope === 'party' || m.scope === undefined);
            for (const miti of partyMitis) {
                if (isCooldownAvailable(roleId, miti.id, time)) {
                    useMitigation(roleId, miti.id, time);
                }
            }
        }
    };

    let groupToggle = 1;

    const isDangerousTb = (ev: TimelineEvent) => {
        if (ev.target === 'MT' || ev.target === 'ST') {
            return (ev.damageAmount || 0) >= extremeTbThreshold || ev.nameEn?.toLowerCase().includes('(tb)') || ev.name?.includes('(TB)') || ev.name?.includes('強攻撃');
        }
        return false;
    };

    // Step 3: Pass 1 - Lethal Damage Lock
    for (const ev of sortedEvents) {
        const isAoE = ev.target === 'AoE';
        const isExtAoE = isAoE && (ev.damageAmount || 0) >= extremeAoeThreshold;

        const isTB = ev.target === 'MT' || ev.target === 'ST';
        const isExtTB = isTB && (ev.damageAmount || 0) >= extremeTbThreshold;

        const time = ev.time;

        if (isExtAoE) {
            const currentGroup = groupToggle === 1 ? GROUP1_ROLES : GROUP2_ROLES;

            tryRoleMitis(currentGroup.filter(r => r !== 'H1' && r !== 'H2'), time);

            // D3 Absolute Rule
            const d3 = party.find(m => m.id === 'D3');
            if (d3?.jobId) {
                const d3Miti = d3.jobId === 'brd' ? 'troubadour' : d3.jobId === 'mch' ? 'tactician' : 'shield_samba';
                if (isCooldownAvailable('D3', d3Miti, time)) useMitigation('D3', d3Miti, time);
            }

            // BH Sets and Short
            if (bhSets) {
                if (bhSets.setA.every(id => isCooldownAvailable('H2', id, time))) {
                    bhSets.setA.forEach(id => useMitigation('H2', id, time));
                } else if (bhSets.setB.every(id => isCooldownAvailable('H2', id, time))) {
                    bhSets.setB.forEach(id => useMitigation('H2', id, time));
                } else if (bhSets.setC?.every(id => isCooldownAvailable('H2', id, time))) {
                    bhSets.setC.forEach(id => useMitigation('H2', id, time));
                } else {
                    [...bhSets.setA, ...bhSets.setB].forEach(id => {
                        if (isCooldownAvailable('H2', id, time)) useMitigation('H2', id, time);
                    });
                }
                if (isCooldownAvailable('H2', bhSets.short, time)) {
                    useMitigation('H2', bhSets.short, time);
                }
            }

            // PH Heavy and Short
            const h1Job = party.find(m => m.id === 'H1')?.jobId;
            if (h1Job === 'whm') {
                if (isCooldownAvailable('H1', 'temperance', time)) useMitigation('H1', 'temperance', time);
                if (isCooldownAvailable('H1', 'liturgy_of_the_bell', time)) useMitigation('H1', 'liturgy_of_the_bell', time);
                if (isCooldownAvailable('H1', 'plenary_indulgence', time)) useMitigation('H1', 'plenary_indulgence', time);
            } else if (h1Job === 'ast') {
                if (isCooldownAvailable('H1', 'neutral_sect', time)) useMitigation('H1', 'neutral_sect', time);
                if (isCooldownAvailable('H1', 'macrocosmos', time)) useMitigation('H1', 'macrocosmos', time);
                if (isCooldownAvailable('H1', 'collective_unconscious', time)) useMitigation('H1', 'collective_unconscious', time);
            }

            groupToggle = groupToggle === 1 ? 2 : 1;

        } else if (isExtTB) {
            const targetId = ev.target === 'MT' ? 'MT' : 'ST';
            const tankJob = party.find(m => m.id === targetId)?.jobId as keyof typeof tankSkills;
            if (tankJob && tankSkills[tankJob]) {
                const skills = tankSkills[tankJob];
                const rampart = `rampart_${tankJob}`;

                if (isCooldownAvailable(targetId, skills.invuln, time)) {
                    useMitigation(targetId, skills.invuln, time);
                } else {
                    if (isCooldownAvailable(targetId, skills.heavy, time)) useMitigation(targetId, skills.heavy, time);
                    if (isCooldownAvailable(targetId, rampart, time)) useMitigation(targetId, rampart, time);
                    if (isCooldownAvailable(targetId, skills.mid, time)) useMitigation(targetId, skills.mid, time);
                    if (isCooldownAvailable(targetId, skills.short, time)) useMitigation(targetId, skills.short, time);
                }
            }
        }
    }

    // Step 4: Pass 2 - Eco-Mode
    for (const ev of sortedEvents) {
        const isAoE = ev.target === 'AoE';
        const isExtAoE = isAoE && (ev.damageAmount || 0) >= extremeAoeThreshold;
        const isTB = ev.target === 'MT' || ev.target === 'ST';
        const isExtTB = isTB && (ev.damageAmount || 0) >= extremeTbThreshold;

        // Skip events already processed in Pass 1
        if (isExtAoE || isExtTB) continue;

        const time = ev.time;

        if (isAoE) {
            let mitigationsDeployed = 0;

            if (bhSets) {
                if (isCooldownAvailable('H2', bhSets.short, time)) {
                    useMitigation('H2', bhSets.short, time);
                    mitigationsDeployed++;
                }
            }

            const h1Job = party.find(m => m.id === 'H1')?.jobId;
            if (h1Job === 'ast') {
                if (isCooldownAvailable('H1', 'collective_unconscious', time)) {
                    useMitigation('H1', 'collective_unconscious', time);
                    mitigationsDeployed++;
                }
            } else if (h1Job === 'whm') {
                if (isCooldownAvailable('H1', 'plenary_indulgence', time)) {
                    useMitigation('H1', 'plenary_indulgence', time);
                    mitigationsDeployed++;
                }
            }

            if (mitigationsDeployed === 0) {
                const mtJob = party.find(m => m.id === 'MT')?.jobId;
                const stJob = party.find(m => m.id === 'ST')?.jobId;
                if (mtJob && isCooldownAvailable('MT', `reprisal_${mtJob}`, time)) {
                    useMitigation('MT', `reprisal_${mtJob}`, time);
                } else if (stJob && isCooldownAvailable('ST', `reprisal_${stJob}`, time)) {
                    useMitigation('ST', `reprisal_${stJob}`, time);
                } else {
                    const meleeJob = party.find(m => m.role === 'dps' && ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'].includes(m.jobId!));
                    if (meleeJob && isCooldownAvailable(meleeJob.id, `feint_${meleeJob.jobId}`, time)) {
                        useMitigation(meleeJob.id, `feint_${meleeJob.jobId}`, time);
                    } else {
                        const casterJob = party.find(m => m.role === 'dps' && ['blm', 'smn', 'rdm', 'pct'].includes(m.jobId!));
                        if (casterJob && isCooldownAvailable(casterJob.id, `addle_${casterJob.jobId}`, time)) {
                            useMitigation(casterJob.id, `addle_${casterJob.jobId}`, time);
                        }
                    }
                }
            }
        } else if (isTB && isDangerousTb(ev)) {
            const targetId = ev.target === 'MT' ? 'MT' : 'ST';
            const tankJob = party.find(m => m.id === targetId)?.jobId as keyof typeof tankSkills;
            if (tankJob && tankSkills[tankJob]) {
                const skills = tankSkills[tankJob];
                const rampart = `rampart_${tankJob}`;

                if (isCooldownAvailable(targetId, rampart, time)) {
                    useMitigation(targetId, rampart, time);
                    if (isCooldownAvailable(targetId, skills.mid, time)) useMitigation(targetId, skills.mid, time);
                    if (isCooldownAvailable(targetId, skills.short, time)) useMitigation(targetId, skills.short, time);
                } else if (isCooldownAvailable(targetId, skills.heavy, time)) {
                    useMitigation(targetId, skills.heavy, time);
                    if (isCooldownAvailable(targetId, skills.short, time)) useMitigation(targetId, skills.short, time);
                } else {
                    if (isCooldownAvailable(targetId, skills.mid, time)) useMitigation(targetId, skills.mid, time);
                    if (isCooldownAvailable(targetId, skills.short, time)) useMitigation(targetId, skills.short, time);
                }
            }
        }
    }

    return assignments.sort((a, b) => a.time - b.time);
}
