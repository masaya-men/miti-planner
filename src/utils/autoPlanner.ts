import type { TimelineEvent, PartyMember, AppliedMitigation, Mitigation } from '../types';
import { MITIGATIONS } from '../data/mockData';

// -----------------------------------------------------------------------------
// FF14 Mitigation Auto-Planner Engine V4 (Priority / 2-Pass Scheduling)
// -----------------------------------------------------------------------------

const EXCLUDED_MITIGATIONS = new Set(['passage_of_arms']);

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
    settings?: { tankHp: number; dpsHp: number }
): AppliedMitigation[] {
    const assignments: AppliedMitigation[] = [];

    const safeSettings = {
        tankHp: settings?.tankHp ?? 299000,
        dpsHp: settings?.dpsHp ?? 199000,
    };

    const memberMitigations = new Map<string, Mitigation[]>();
    for (const member of party) {
        if (member.jobId) {
            memberMitigations.set(member.id, MITIGATIONS.filter(m =>
                (m.jobId === member.jobId || m.jobId === member.role) &&
                !EXCLUDED_MITIGATIONS.has(m.id)
            ));
        }
    }

    // Interval Check Function
    const usageTimes = new Map<string, number[]>();

    const isCooldownAvailable = (memberId: string, mitiId: string, time: number): boolean => {
        const miti = getMitigation(mitiId);
        if (!miti) return false;

        const memberMitis = memberMitigations.get(memberId) || [];
        if (!memberMitis.some(m => m.id === mitiId)) return false;

        const key = `${memberId}_${mitiId}`;
        const times = usageTimes.get(key) || [];
        for (const usedTime of times) {
            if (Math.abs(time - usedTime) < miti.cooldown) {
                return false;
            }
        }

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
        if (!miti) return null;

        const assignment: AppliedMitigation = {
            id: crypto.randomUUID(),
            mitigationId: miti.id,
            time: time,
            duration: miti.duration,
            ownerId: memberId,
        };
        assignments.push(assignment);

        const key = `${memberId}_${mitiId}`;
        const times = usageTimes.get(key) || [];
        times.push(time);
        usageTimes.set(key, times);

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

        return assignment;
    };

    const cancelAssignment = (targetId: string, mitiId: string, timeToRemove: number) => {
        const index = assignments.findIndex(a => a.ownerId === targetId && a.mitigationId === mitiId && a.time === timeToRemove);
        if (index > -1) {
            assignments.splice(index, 1);
        }
        const key = `${targetId}_${mitiId}`;
        const times = usageTimes.get(key) || [];
        const tIndex = times.indexOf(timeToRemove);
        if (tIndex > -1) {
            times.splice(tIndex, 1);
            usageTimes.set(key, times);
        }
    };

    // Calculate Real Damage helper
    const calculateRealDamage = (eventTime: number, rawDamage: number, eventTarget: 'MT' | 'ST' | 'AoE'): number => {
        let mitigationMultiplier = 1;

        for (const a of assignments) {
            const miti = getMitigation(a.mitigationId);
            if (!miti) continue;

            const isCoveringEvent = eventTime >= a.time && eventTime <= a.time + a.duration;
            if (!isCoveringEvent) continue;

            if (miti.isInvincible && a.ownerId === eventTarget) {
                return 0; // Invuln is active on target
            }

            if (!miti.isShield && miti.value > 0) {
                if (miti.scope === 'party' || miti.scope === undefined || a.ownerId === eventTarget) {
                    mitigationMultiplier *= (1 - miti.value / 100);
                }
            }
        }

        return rawDamage * mitigationMultiplier;
    };

    // Damage Events
    const damageEvents = timeline.filter(t => (t.target === 'AoE' || t.target === 'MT' || t.target === 'ST') && (t.damageAmount || 0) > 0);
    // Sort strictly chronologically
    const chronologicalEvents = [...damageEvents].sort((a, b) => a.time - b.time);

    let currentTurn = 1;

    const tryAssignMiti = (roleId: string, mitiId: string, time: number): boolean => {
        const member = party.find(m => m.id === roleId || m.role === roleId);
        if (member && isCooldownAvailable(member.id, mitiId, time)) {
            useMitigation(member.id, mitiId, time);
            return true;
        }
        return false;
    };

    const tanks = { mt: party.find(m => m.id === 'MT'), st: party.find(m => m.id === 'ST') };
    const healers = { h1: party.find(m => m.id === 'H1'), h2: party.find(m => m.id === 'H2') };
    const melees = party.filter(m => m.role === 'dps' && ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'].includes(m.jobId!));
    const casters = party.filter(m => m.role === 'dps' && ['blm', 'smn', 'rdm', 'pct'].includes(m.jobId!));
    const ranged = party.filter(m => m.role === 'dps' && ['brd', 'mch', 'dnc'].includes(m.jobId!));

    const tryRoleGeneric = (partyMember: PartyMember | undefined, type: 'reprisal' | '90s_tank' | 'feint' | 'addle' | '90s_ranged', time: number) => {
        if (!partyMember || !partyMember.jobId) return false;

        let mitiId = '';
        if (type === 'reprisal') mitiId = `reprisal_${partyMember.jobId}`;
        else if (type === '90s_tank') mitiId = partyMember.jobId === 'war' ? 'shake_it_off' : partyMember.jobId === 'pld' ? 'divine_veil' : partyMember.jobId === 'drk' ? 'dark_missionary' : 'heart_of_light';
        else if (type === 'feint') mitiId = `feint_${partyMember.jobId}`;
        else if (type === 'addle') mitiId = `addle_${partyMember.jobId}`;
        else if (type === '90s_ranged') mitiId = partyMember.jobId === 'brd' ? 'troubadour' : partyMember.jobId === 'mch' ? 'tactician' : 'shield_samba';

        return tryAssignMiti(partyMember.id, mitiId, time);
    };

    const getH1CoverSets = (job: string) => job === 'whm' ? ['temperance', 'liturgy_of_the_bell', 'plenary_indulgence'] : ['neutral_sect', 'macrocosmos', 'collective_unconscious'];
    const getH2CoverSets = (job: string) => job === 'sch' ? ['sacred_soil', 'summon_seraph', 'recitation_deployment_tactics', 'expedient'] : ['kerachole', 'holos', 'panhaima', 'philosophia'];

    const getH1Short = (job: string) => job === 'whm' ? 'plenary_indulgence' : 'collective_unconscious';
    const getH1Mid = (job: string) => job === 'whm' ? 'liturgy_of_the_bell' : 'macrocosmos';
    const getH2Short = (job: string) => job === 'sch' ? 'sacred_soil' : 'kerachole';
    const getH2Mid = (job: string) => job === 'sch' ? 'fey_illumination' : 'holos';

    const tankSkills = {
        pld: { invuln: 'hallowed_ground', heavy: 'guardian', mid: 'bulwark', short: 'holy_sheltron', partnerShort: 'intervention' },
        war: { invuln: 'holmgang', heavy: 'damnation', mid: 'thrill_of_battle', short: 'bloodwhetting', partnerShort: 'nascent_flash' },
        drk: { invuln: 'living_dead', heavy: 'shadowed_vigil', mid: 'dark_mind', short: 'the_blackest_night', partnerShort: 'oblation' },
        gnb: { invuln: 'superbolide', heavy: 'great_nebula', mid: 'camouflage', short: 'heart_of_corundum', partnerShort: 'heart_of_corundum' },
    };

    for (const ev of chronologicalEvents) {
        const time = ev.time;
        const rawDamage = ev.damageAmount || 0;

        // Skip consecutive AoEs (process the first one of the flurry)
        if (ev.target === 'AoE') {
            const previousAoE = chronologicalEvents.find(e => e.target === 'AoE' && e.time < time && time - e.time <= 3);
            if (previousAoE) continue;
        }

        if (ev.target === 'AoE') {
            // -- GROUP ROTATION ASSIGNMENT --
            if (currentTurn === 1) {
                // Group 1: MT, H1(Short/Mid), D1(Feint), D3(90s)
                tryRoleGeneric(tanks.mt, 'reprisal', time);
                tryRoleGeneric(tanks.mt, '90s_tank', time);

                if (healers.h1?.jobId) {
                    tryAssignMiti('H1', getH1Short(healers.h1.jobId), time);
                    tryAssignMiti('H1', getH1Mid(healers.h1.jobId), time);
                }

                if (melees.length > 0) tryRoleGeneric(melees[0], 'feint', time);
                if (ranged.length > 0) tryRoleGeneric(ranged[0], '90s_ranged', time);

            } else {
                // Group 2: ST, H2(Short/Mid), D2(Feint), D4(Addle)
                tryRoleGeneric(tanks.st, 'reprisal', time);
                tryRoleGeneric(tanks.st, '90s_tank', time);

                if (healers.h2?.jobId) {
                    tryAssignMiti('H2', getH2Short(healers.h2.jobId), time);
                    tryAssignMiti('H2', getH2Mid(healers.h2.jobId), time);
                }

                if (melees.length > 1) tryRoleGeneric(melees[1], 'feint', time);
                if (casters.length > 0) tryRoleGeneric(casters[0], 'addle', time);
            }

            // -- HP CALCULATION WHILE LOOP --
            let realDamage = calculateRealDamage(time, rawDamage, 'AoE');

            if (realDamage > safeSettings.dpsHp) {
                // Determine Cover Set
                const coverSet: { role: string, mitiId: string }[] = [];

                if (healers.h1?.jobId) getH1CoverSets(healers.h1.jobId).forEach(id => coverSet.push({ role: 'H1', mitiId: id }));
                if (healers.h2?.jobId) getH2CoverSets(healers.h2.jobId).forEach(id => coverSet.push({ role: 'H2', mitiId: id }));

                const d4 = casters[0];
                if (d4?.jobId === 'rdm') coverSet.push({ role: d4.id, mitiId: 'magick_barrier' });

                const d3 = ranged[0];
                if (d3?.jobId === 'brd') coverSet.push({ role: d3.id, mitiId: 'nature_s_minne' });
                else if (d3?.jobId === 'dnc') coverSet.push({ role: d3.id, mitiId: 'improvisation' });

                const mnk = melees.find(m => m.jobId === 'mnk');
                if (mnk) coverSet.push({ role: mnk.id, mitiId: 'mantra' });

                // Add to schedule until we survive
                for (const coverSkill of coverSet) {
                    if (realDamage <= safeSettings.dpsHp) break;

                    if (tryAssignMiti(coverSkill.role, coverSkill.mitiId, time)) {
                        realDamage = calculateRealDamage(time, rawDamage, 'AoE');
                    }
                }
            }

            // Flip turn
            currentTurn = currentTurn === 1 ? 2 : 1;

        } else if (ev.target === 'MT' || ev.target === 'ST') {
            const isTB = rawDamage >= (safeSettings.tankHp * 0.5) || ev.nameEn?.toLowerCase().includes('(tb)') || ev.name?.includes('(TB)') || ev.name?.includes('強攻撃');
            if (!isTB) continue;

            const targetId = ev.target;
            const partnerId = targetId === 'MT' ? 'ST' : 'MT';
            const targetTank = targetId === 'MT' ? tanks.mt : tanks.st;
            const partnerTank = targetId === 'MT' ? tanks.st : tanks.mt;

            if (!targetTank?.jobId) continue;
            const skills = tankSkills[targetTank.jobId as keyof typeof tankSkills];
            const rampart = `rampart_${targetTank.jobId}`;

            // Try standard Busters
            const assignedIds: string[] = [];

            if (isCooldownAvailable(targetId, rampart, time)) {
                if (tryAssignMiti(targetId, rampart, time)) assignedIds.push(rampart);
                if (tryAssignMiti(targetId, skills.mid, time)) assignedIds.push(skills.mid);
                if (tryAssignMiti(targetId, skills.short, time)) assignedIds.push(skills.short);
            } else if (isCooldownAvailable(targetId, skills.heavy, time)) {
                if (tryAssignMiti(targetId, skills.heavy, time)) assignedIds.push(skills.heavy);
                if (tryAssignMiti(targetId, skills.short, time)) assignedIds.push(skills.short);
            } else {
                if (tryAssignMiti(targetId, skills.mid, time)) assignedIds.push(skills.mid);
                if (tryAssignMiti(targetId, skills.short, time)) assignedIds.push(skills.short);
            }

            // Partner covert
            if (partnerTank?.jobId) {
                const pSkills = tankSkills[partnerTank.jobId as keyof typeof tankSkills];
                if (tryAssignMiti(partnerId, pSkills.partnerShort, time)) assignedIds.push(`partner_${pSkills.partnerShort}`);
            }

            // Check if survived
            const realDamage = calculateRealDamage(time, rawDamage, targetId);

            // If lethal, or if we couldn't even assign 2 personal buffs
            if (realDamage > safeSettings.tankHp || assignedIds.filter(id => !id.startsWith('partner_')).length === 0) {
                if (isCooldownAvailable(targetId, skills.invuln, time)) {
                    // Cancel all assigned standard buffs for this mechanic to save for later
                    for (const id of assignedIds) {
                        if (id.startsWith('partner_')) {
                            cancelAssignment(partnerId, id.split('_')[1], time);
                        } else {
                            cancelAssignment(targetId, id, time);
                        }
                    }
                    // Apply Invuln
                    useMitigation(targetId, skills.invuln, time);
                }
            }
        }
    }

    return assignments.sort((a, b) => a.time - b.time);
}
