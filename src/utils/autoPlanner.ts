import type { TimelineEvent, PartyMember, AppliedMitigation, Mitigation } from '../types';
import { MITIGATIONS } from '../data/mockData';

// -----------------------------------------------------------------------------
// FF14 Mitigation Auto-Planner Engine V5
// — Danger-scored AoE scheduling with healer set rotation
// — Lethal damage verification loop
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

// ─── Healer Set Definitions ─────────────────────────────────────────────

// Scholar sets (ordered by priority: A = most powerful → D = lightest)
// Set A1: 陣 + 秘策：展開戦術 + サモンセラフィム + フェイイルミネーション
// Set A2: 陣 + 秘策：展開戦術 + 疾風怒濤  (alternative A when seraph on CD)
// Set B:  陣 + サモンセラフィム + フェイイルミネーション
// Set C:  陣 + 疾風怒濤  (same priority as B, alternated)
// Set D:  陣 + 秘策：展開戦術 (意気軒高)
const SCH_SETS = {
    A1: ['sacred_soil', 'recitation_deployment_tactics', 'summon_seraph', 'fey_illumination'],
    A2: ['sacred_soil', 'recitation_deployment_tactics', 'expedient'],
    B: ['sacred_soil', 'summon_seraph', 'fey_illumination'],
    C: ['sacred_soil', 'expedient'],
    D: ['sacred_soil', 'recitation_deployment_tactics'],
};

// Sage sets
// Set A: ケーラコレ + パンハイマ + ホーリズム
// Set B: ケーラコレ + ホーリズム (same priority as C, alternated)
// Set C: ケーラコレ + パンハイマ (same priority as B, alternated)
// Set D: ケーラコレ + エウクラシアプログノシスII
const SGE_SETS = {
    A: ['kerachole', 'panhaima', 'holos'],
    B: ['kerachole', 'holos'],
    C: ['kerachole', 'panhaima'],
    D: ['kerachole', 'eukrasian_prognosis_ii'],
};

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

    // ─── Usage Tracking ─────────────────────────────────────────────────
    const usageTimes = new Map<string, number[]>();

    const isCooldownAvailable = (memberId: string, mitiId: string, time: number): boolean => {
        const miti = getMitigation(mitiId);
        if (!miti) return false;
        if (!mitiId) return false;

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

    const useMitigation = (memberId: string, mitiId: string, time: number, targetId?: string) => {
        const miti = getMitigation(mitiId);
        if (!miti) return null;

        const assignment: AppliedMitigation = {
            id: crypto.randomUUID(),
            mitigationId: miti.id,
            time: time,
            duration: miti.duration,
            ownerId: memberId,
            targetId: targetId,
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
        const member = party.find(m => m.id === targetId || m.role === targetId);
        if (!member) return;

        const index = assignments.findIndex(a => a.ownerId === member.id && a.mitigationId === mitiId && a.time === timeToRemove);
        if (index > -1) {
            assignments.splice(index, 1);
        }
        const key = `${member.id}_${mitiId}`;
        const times = usageTimes.get(key) || [];
        const tIndex = times.indexOf(timeToRemove);
        if (tIndex > -1) {
            times.splice(tIndex, 1);
            usageTimes.set(key, times);
        }

        // Also cancel derived skill
        if (DERIVED_SKILLS_MAP[mitiId]) {
            const derivedId = DERIVED_SKILLS_MAP[mitiId];
            const dIndex = assignments.findIndex(a => a.ownerId === member.id && a.mitigationId === derivedId && a.time === timeToRemove);
            if (dIndex > -1) assignments.splice(dIndex, 1);
            const dKey = `${member.id}_${derivedId}`;
            const dTimes = usageTimes.get(dKey) || [];
            const dtIndex = dTimes.indexOf(timeToRemove);
            if (dtIndex > -1) { dTimes.splice(dtIndex, 1); usageTimes.set(dKey, dTimes); }
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
                return 0;
            }

            if (!miti.isShield && miti.value > 0) {
                if (miti.scope === 'party' || miti.scope === undefined || a.ownerId === eventTarget) {
                    mitigationMultiplier *= (1 - miti.value / 100);
                }
            }
        }

        return rawDamage * mitigationMultiplier;
    };

    // ─── Helper Functions ────────────────────────────────────────────────

    const tryAssignMiti = (roleId: string, mitiId: string, time: number, targetId?: string): boolean => {
        if (!mitiId) return false;
        const member = party.find(m => m.id === roleId || m.role === roleId);
        if (member && isCooldownAvailable(member.id, mitiId, time)) {
            useMitigation(member.id, mitiId, time, targetId);
            return true;
        }
        return false;
    };

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

    // ─── Party Role Discovery ────────────────────────────────────────────

    const tanks = { mt: party.find(m => m.id === 'MT'), st: party.find(m => m.id === 'ST') };
    const healers = { h1: party.find(m => m.id === 'H1'), h2: party.find(m => m.id === 'H2') };
    const melees = party.filter(m => m.role === 'dps' && ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'].includes(m.jobId!));
    const casters = party.filter(m => m.role === 'dps' && ['blm', 'smn', 'rdm', 'pct'].includes(m.jobId!));
    const ranged = party.filter(m => m.role === 'dps' && ['brd', 'mch', 'dnc'].includes(m.jobId!));

    const tankSkills = {
        pld: { invuln: 'hallowed_ground', heavy: 'guardian', mid: 'bulwark', short: 'holy_sheltron', partnerShort: 'intervention' },
        war: { invuln: 'holmgang', heavy: 'damnation', mid: 'thrill_of_battle', short: 'bloodwhetting', partnerShort: 'nascent_flash' },
        drk: { invuln: 'living_dead', heavy: 'shadowed_vigil', mid: 'dark_mind', short: 'the_blackest_night', partnerShort: 'oblation' },
        gnb: { invuln: 'superbolide', heavy: 'great_nebula', mid: 'camouflage', short: 'heart_of_corundum', partnerShort: 'heart_of_corundum' },
    };

    // WHM / AST H1 skills
    const getH1Short = (job: string) => job === 'whm' ? '' : 'collective_unconscious';
    const getH1CoverSets = (job: string) => job === 'whm' ? ['temperance'] : ['neutral_sect', 'collective_unconscious'];

    // ─── Damage Events ───────────────────────────────────────────────────

    const damageEvents = timeline.filter(t =>
        (t.target === 'AoE' || t.target === 'MT' || t.target === 'ST') && (t.damageAmount || 0) > 0
    );
    const chronologicalEvents = [...damageEvents].sort((a, b) => a.time - b.time);

    // ═════════════════════════════════════════════════════════════════════
    // PASS 1: DANGER-SCORED HEALER SET ASSIGNMENT (AoE only)
    // ═════════════════════════════════════════════════════════════════════

    // Collect unique AoE events (skip consecutive AoEs within 3s)
    const aoeEvents: TimelineEvent[] = [];
    for (const ev of chronologicalEvents) {
        if (ev.target !== 'AoE') continue;
        const previousAoE = aoeEvents.find(e => ev.time - e.time <= 3 && ev.time > e.time);
        if (previousAoE) continue;
        aoeEvents.push(ev);
    }

    // Score and sort by danger (descending)
    const scoredAoEs = aoeEvents.map(ev => ({
        event: ev,
        dangerScore: (ev.damageAmount || 0) / safeSettings.dpsHp,
    })).sort((a, b) => b.dangerScore - a.dangerScore);

    // Assign healer sets based on danger ranking
    const h2Job = healers.h2?.jobId;
    const h2Id = healers.h2?.id;

    if (h2Id && h2Job) {
        // Try to assign a set to each AoE (from most dangerous to least)
        const tryHealerSet = (skills: string[], time: number): boolean => {
            // Check all skills in the set are available
            const allAvailable = skills.every(s => isCooldownAvailable(h2Id, s, time));
            if (!allAvailable) return false;
            for (const s of skills) {
                // summon_seraph auto-assigns fey_illumination via DERIVED_SKILLS_MAP? No, it doesn't.
                // We assign each explicitly
                useMitigation(h2Id, s, time);
            }
            return true;
        };

        if (h2Job === 'sch') {
            // Scholar set assignment
            let bcToggle = false; // false = B first, true = C first
            for (const scored of scoredAoEs) {
                const t = scored.event.time;
                // Try Set A (most powerful) for the most dangerous events
                if (scored.dangerScore > 0.7) {
                    if (!tryHealerSet(SCH_SETS.A1, t)) {
                        tryHealerSet(SCH_SETS.A2, t);
                    }
                    continue;
                }
                // Alternate B and C for medium danger
                if (scored.dangerScore > 0.4) {
                    const first = bcToggle ? SCH_SETS.C : SCH_SETS.B;
                    const second = bcToggle ? SCH_SETS.B : SCH_SETS.C;
                    if (!tryHealerSet(first, t)) {
                        tryHealerSet(second, t);
                    }
                    bcToggle = !bcToggle;
                    continue;
                }
                // Set D for lighter events
                tryHealerSet(SCH_SETS.D, t);
            }
        } else if (h2Job === 'sge') {
            // Sage set assignment
            let bcToggle = false;
            for (const scored of scoredAoEs) {
                const t = scored.event.time;
                if (scored.dangerScore > 0.7) {
                    tryHealerSet(SGE_SETS.A, t);
                    continue;
                }
                if (scored.dangerScore > 0.4) {
                    const first = bcToggle ? SGE_SETS.C : SGE_SETS.B;
                    const second = bcToggle ? SGE_SETS.B : SGE_SETS.C;
                    if (!tryHealerSet(first, t)) {
                        tryHealerSet(second, t);
                    }
                    bcToggle = !bcToggle;
                    continue;
                }
                tryHealerSet(SGE_SETS.D, t);
            }
        }
    }

    // H1 sets (WHM / AST) - simpler rotation
    const h1Job = healers.h1?.jobId;
    if (healers.h1?.id && h1Job) {
        const h1CoverSkills = getH1CoverSets(h1Job);
        let h1SetIdx = 0;
        for (const scored of scoredAoEs) {
            if (scored.dangerScore > 0.5) {
                const skill = h1CoverSkills[h1SetIdx % h1CoverSkills.length];
                tryAssignMiti('H1', skill, scored.event.time);
                h1SetIdx++;
            } else {
                const shortSkill = getH1Short(h1Job);
                if (shortSkill) tryAssignMiti('H1', shortSkill, scored.event.time);
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    // PASS 2: GROUP ROTATION (Tanks + DPS mitigation for AoE)
    // ═════════════════════════════════════════════════════════════════════

    let currentTurn = 1;

    for (const ev of chronologicalEvents) {
        const time = ev.time;
        const rawDamage = ev.damageAmount || 0;

        if (ev.target === 'AoE') {
            // Skip consecutive AoEs (already handled in healer set pass)
            const previousAoE = chronologicalEvents.find(e =>
                e.target === 'AoE' && e.time < time && time - e.time <= 3
            );
            if (previousAoE) continue;

            // Group rotation: tanks + DPS
            if (currentTurn === 1) {
                // Group 1: MT reprisal+90s, D1 feint, D3 ranged90s
                tryRoleGeneric(tanks.mt, 'reprisal', time);
                tryRoleGeneric(tanks.mt, '90s_tank', time);
                if (melees.length > 0) tryRoleGeneric(melees[0], 'feint', time);
                if (ranged.length > 0) tryRoleGeneric(ranged[0], '90s_ranged', time);
            } else {
                // Group 2: ST reprisal+90s, D2 feint, D4 addle
                tryRoleGeneric(tanks.st, 'reprisal', time);
                tryRoleGeneric(tanks.st, '90s_tank', time);
                if (melees.length > 1) tryRoleGeneric(melees[1], 'feint', time);
                if (casters.length > 0) tryRoleGeneric(casters[0], 'addle', time);
            }

            currentTurn = currentTurn === 1 ? 2 : 1;

        } else if (ev.target === 'MT' || ev.target === 'ST') {
            // ── Tank Buster Handling (unchanged logic) ──────────────
            const isTB = rawDamage >= (safeSettings.tankHp * 0.5) ||
                ev.nameEn?.toLowerCase().includes('(tb)') ||
                ev.name?.includes('(TB)') || ev.name?.includes('強攻撃');
            if (!isTB) continue;

            const targetId = ev.target;
            const partnerId = targetId === 'MT' ? 'ST' : 'MT';
            const targetTank = targetId === 'MT' ? tanks.mt : tanks.st;
            const partnerTank = targetId === 'MT' ? tanks.st : tanks.mt;

            if (!targetTank?.jobId) continue;
            const skills = tankSkills[targetTank.jobId as keyof typeof tankSkills];
            if (!skills) continue;
            const rampart = `rampart_${targetTank.jobId}`;

            // Check if already invincible
            let hasInvulnActive = false;
            for (const a of assignments) {
                if (a.ownerId === targetTank.id && a.mitigationId === skills.invuln &&
                    time >= a.time && time < a.time + a.duration) {
                    hasInvulnActive = true;
                    break;
                }
            }
            if (hasInvulnActive) continue;

            // Group consecutive TBs
            const previousTB = chronologicalEvents.find(e =>
                e.target === targetId && e.time < time && time - e.time <= 5 &&
                (e.damageAmount! >= (safeSettings.tankHp * 0.5) || e.nameEn?.toLowerCase().includes('(tb)') || e.name?.includes('(TB)') || e.name?.includes('強攻撃'))
            );
            if (previousTB) continue;

            const flurryHits = chronologicalEvents.filter(e =>
                e.target === targetId && e.time >= time && e.time - time <= 5 &&
                (e.damageAmount! >= (safeSettings.tankHp * 0.5) || e.nameEn?.toLowerCase().includes('(tb)') || e.name?.includes('(TB)') || e.name?.includes('強攻撃'))
            );
            const maxRawDamage = Math.max(...flurryHits.map(e => e.damageAmount || 0));

            // Tank skill assignment
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

            // Partner cover
            if (partnerTank?.jobId) {
                const pSkills = tankSkills[partnerTank.jobId as keyof typeof tankSkills];
                if (pSkills && tryAssignMiti(partnerId, pSkills.partnerShort, time, targetId)) {
                    assignedIds.push(`partner_${pSkills.partnerShort}`);
                }
            }

            // Lethal check → use invuln
            const realDamage = calculateRealDamage(time, maxRawDamage, targetId);
            if (realDamage > safeSettings.tankHp || assignedIds.filter(id => !id.startsWith('partner_')).length === 0) {
                if (isCooldownAvailable(targetId, skills.invuln, time)) {
                    for (const id of assignedIds) {
                        if (id.startsWith('partner_')) {
                            cancelAssignment(partnerId, id.replace('partner_', ''), time);
                        } else {
                            cancelAssignment(targetId, id, time);
                        }
                    }
                    useMitigation(targetId, skills.invuln, time);
                }
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    // PASS 3: LETHAL DAMAGE VERIFICATION (AoE survivability)
    // ═════════════════════════════════════════════════════════════════════

    // Check every AoE — if damage still exceeds DPS HP, try to add more mitigation
    for (const ev of aoeEvents) {
        const time = ev.time;
        const rawDamage = ev.damageAmount || 0;
        let realDamage = calculateRealDamage(time, rawDamage, 'AoE');

        if (realDamage <= safeSettings.dpsHp) continue;

        // Emergency mitigation pool — try whatever is still available
        const emergencyPool: { role: string; mitiId: string }[] = [];

        // H2 additional skills
        if (h2Id && h2Job === 'sch') {
            emergencyPool.push(
                { role: h2Id, mitiId: 'sacred_soil' },
                { role: h2Id, mitiId: 'expedient' },
                { role: h2Id, mitiId: 'recitation_deployment_tactics' },
                { role: h2Id, mitiId: 'summon_seraph' },
                { role: h2Id, mitiId: 'fey_illumination' },
            );
        } else if (h2Id && h2Job === 'sge') {
            emergencyPool.push(
                { role: h2Id, mitiId: 'kerachole' },
                { role: h2Id, mitiId: 'holos' },
                { role: h2Id, mitiId: 'panhaima' },
                { role: h2Id, mitiId: 'eukrasian_prognosis_ii' },
            );
        }

        // H1 skills
        if (healers.h1?.id && h1Job) {
            for (const skill of getH1CoverSets(h1Job)) {
                emergencyPool.push({ role: healers.h1.id, mitiId: skill });
            }
            const shortSkill = getH1Short(h1Job);
            if (shortSkill) emergencyPool.push({ role: healers.h1.id, mitiId: shortSkill });
        }

        // DPS utility
        const d4 = casters[0];
        if (d4?.jobId === 'rdm') emergencyPool.push({ role: d4.id, mitiId: 'magick_barrier' });
        const d3 = ranged[0];
        if (d3?.jobId === 'brd') emergencyPool.push({ role: d3.id, mitiId: 'nature_s_minne' });
        else if (d3?.jobId === 'dnc') emergencyPool.push({ role: d3.id, mitiId: 'improvisation' });
        const mnk = melees.find(m => m.jobId === 'mnk');
        if (mnk) emergencyPool.push({ role: mnk.id, mitiId: 'mantra' });

        // Tank reprisals and 90s as last resort
        if (tanks.mt?.jobId) {
            emergencyPool.push({ role: tanks.mt.id, mitiId: `reprisal_${tanks.mt.jobId}` });
            tryRoleGeneric(tanks.mt, '90s_tank', time);
        }
        if (tanks.st?.jobId) {
            emergencyPool.push({ role: tanks.st.id, mitiId: `reprisal_${tanks.st.jobId}` });
            tryRoleGeneric(tanks.st, '90s_tank', time);
        }

        // Try each emergency skill until we survive
        for (const skill of emergencyPool) {
            if (realDamage <= safeSettings.dpsHp) break;
            if (tryAssignMiti(skill.role, skill.mitiId, time)) {
                realDamage = calculateRealDamage(time, rawDamage, 'AoE');
            }
        }
    }

    return assignments.sort((a, b) => a.time - b.time);
}
