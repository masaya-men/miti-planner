import type { AppliedMitigation } from '../types';
import { MITIGATIONS, getMitigationPriority } from '../data/mockData';

export type MigrationMode = 'inherit' | 'common_only' | 'reset';

function genId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'evt_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Migrates a set of mitigations from an old job to a new job based on the family attribute.
 *
 * @param oldJobId The ID of the previous job
 * @param newJobId The ID of the new job
 * @param _ownerId The party member ID (e.g., 'MT', 'H1') (Unused currently but kept for expansion)
 * @param currentMitigations The member's currently assigned mitigations
 * @param mode The migration strategy ('inherit' | 'common_only' | 'reset')
 * @returns A new array of mitigations adapted for the new job
 */
export function migrateMitigations(
    oldJobId: string,
    newJobId: string,
    _ownerId: string,
    currentMitigations: AppliedMitigation[],
    mode: MigrationMode
): AppliedMitigation[] {
    if (mode === 'reset') {
        return [];
    }

    const newJobMitigations = MITIGATIONS.filter(m => m.jobId === newJobId || m.id.endsWith(`_${newJobId}`));

    // Helper to find skills in the new job by family
    const findByFamily = (family: string) => newJobMitigations.filter(m => m.family === family);

    const migrated: AppliedMitigation[] = [];

    // Deduplication check helper
    const isDuplicate = (skillId: string, timeSec: number, targetId?: string) => {
        return migrated.some(m => m.mitigationId === skillId && m.time === timeSec && m.targetId === targetId);
    };

    for (const mit of currentMitigations.sort((a, b) => a.time - b.time)) {
        // Find the definition of the currently applied skill
        const oldDef = MITIGATIONS.find(m => m.id === mit.mitigationId);
        if (!oldDef) continue; // Unknown skill, skip

        if (mode === 'common_only') {
            if (oldDef.family === 'role_action') {
                const newSkills = findByFamily('role_action');
                const baseId = oldDef.id.replace(`_${oldJobId}`, '');
                const targetNewSkill = newSkills.find(s => s.id.startsWith(baseId));

                if (targetNewSkill && !isDuplicate(targetNewSkill.id, mit.time, mit.targetId)) {
                    // Check recast for this skill
                    const lastUse = migrated.filter(m => m.mitigationId === targetNewSkill.id).pop();
                    if (!lastUse || mit.time >= lastUse.time + targetNewSkill.cooldown) {
                        migrated.push({
                            ...mit,
                            id: genId(),
                            mitigationId: targetNewSkill.id,
                            duration: targetNewSkill.duration
                        });
                    }
                }
            }
            continue;
        }

        // mode === 'inherit'
        if (oldDef.family) {
            // Find all matching skills in the new job with the same family
            let replacementSkills = findByFamily(oldDef.family);

            // Special 1-to-many logic for TANK targeted buffs
            if ((oldDef.family === 'tank_short' || oldDef.family === 'tank_sub_targeted') && mit.targetId) {
                const mainShorts = findByFamily('tank_short');
                const subTargeteds = findByFamily('tank_sub_targeted');

                // Try main short (TBN, Corundum etc)
                if (mainShorts.length > 0) {
                    const skill = mainShorts[0];
                    const isSelfOnly = skill.id === 'holy_sheltron' || skill.id === 'bloodwhetting';
                    if (!isSelfOnly && !isDuplicate(skill.id, mit.time, mit.targetId)) {
                        // Recast check
                        const last = migrated.filter(m => m.mitigationId === skill.id).pop();
                        if (!last || mit.time >= last.time + skill.cooldown) {
                            migrated.push({ ...mit, id: genId(), mitigationId: skill.id, duration: skill.duration });
                        }
                    }
                }

                // Try sub targeted (Oblation, Aurora etc)
                subTargeteds.forEach(sub => {
                    if (!isDuplicate(sub.id, mit.time, mit.targetId)) {
                        // Recast check (charges are complex, but basic CD check helps)
                        const last = migrated.filter(m => m.mitigationId === sub.id).pop();
                        if (!last || mit.time >= last.time + sub.cooldown) {
                            migrated.push({ ...mit, id: genId(), mitigationId: sub.id, duration: sub.duration });
                        }
                    }
                });
                continue;
            }

            // Healer A: Old skill is main barrier (bh_120_a e.g. Panhaima).
            if (oldDef.family === 'bh_120_a') {
                const mainBarriers = replacementSkills;
                const subShields = findByFamily('bh_sub_a'); // Fey Illum + Consolation

                if (mainBarriers.length > 0 && !isDuplicate(mainBarriers[0].id, mit.time, mit.targetId)) {
                    const skill = mainBarriers[0];
                    const last = migrated.filter(m => m.mitigationId === skill.id).pop();
                    if (!last || mit.time >= last.time + skill.cooldown) {
                        migrated.push({ ...mit, id: genId(), mitigationId: skill.id, duration: skill.duration });
                    }
                }

                // If it's Seraph, add Illum
                const illum = subShields.find(s => s.id === 'fey_illumination');
                if (illum && !isDuplicate(illum.id, mit.time, mit.targetId)) {
                    const last = migrated.filter(m => m.mitigationId === illum.id).pop();
                    if (!last || mit.time >= last.time + illum.cooldown) {
                        migrated.push({ ...mit, id: genId(), mitigationId: illum.id, duration: illum.duration });
                    }
                }
                continue;
            }

            // Standard direct family match
            if (oldDef.family === 'role_action') {
                const baseId = oldDef.id.replace(`_${oldJobId}`, '');
                replacementSkills = replacementSkills.filter(s => s.id.startsWith(baseId));
            }

            if (replacementSkills.length > 0) {
                const skill = replacementSkills[0];
                if (!isDuplicate(skill.id, mit.time, mit.targetId)) {
                    const last = migrated.filter(m => m.mitigationId === skill.id).pop();
                    if (!last || mit.time >= last.time + (skill.cooldown || 0)) {
                        migrated.push({
                            ...mit,
                            id: genId(),
                            mitigationId: skill.id,
                            duration: skill.duration
                        });
                    }
                }
            }
        }
    }

    // Finally sort them visually
    return migrated.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        return getMitigationPriority(a.mitigationId) - getMitigationPriority(b.mitigationId);
    });
}
