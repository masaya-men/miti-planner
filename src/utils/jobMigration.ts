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

    for (const mit of currentMitigations) {
        // Find the definition of the currently applied skill
        const oldDef = MITIGATIONS.find(m => m.id === mit.mitigationId);
        if (!oldDef) continue; // Unknown skill, skip

        if (mode === 'common_only') {
            if (oldDef.family === 'role_action') {
                const newSkills = findByFamily('role_action');
                // The new job might have a different role action id (e.g. rampart_gnb -> rampart_pld)
                // We match based on the base name (the part before the _) or by just finding one of the same base.
                const baseName = oldDef.id.replace(`_${oldJobId}`, '');
                const targetNewSkill = newSkills.find(s => s.id.startsWith(baseName));

                if (targetNewSkill && !isDuplicate(targetNewSkill.id, mit.time, mit.targetId)) {
                    migrated.push({
                        ...mit,
                        id: genId(),
                        mitigationId: targetNewSkill.id,
                        duration: targetNewSkill.duration
                    });
                }
            }
            continue;
        }

        // mode === 'inherit'
        if (oldDef.family) {
            // Find all matching skills in the new job with the same family
            let replacementSkills = findByFamily(oldDef.family);

            // Special 1-to-many fallback logic based on specific rules:

            // Tank A: Old skill is tank_short OR tank_sub_targeted + has a target -> it is a targeted short buff.
            // If the new job has a sub-targeted buff (Oblation, Aurora, Intervention, Nascent), 
            // we carry them over ALONG WITH the main tank_short buff (TBN, Corundum etc).
            // The user requested to throw ALL possible targeted skills (up to 2).
            if ((oldDef.family === 'tank_short' || oldDef.family === 'tank_sub_targeted') && mit.targetId) {
                const mainShorts = findByFamily('tank_short');
                const subTargeteds = findByFamily('tank_sub_targeted');

                // If the new job has a main tank short, add it.
                // UNLESS it is strictly self-only in FF14 (Holy Sheltron, Bloodwhetting) and we are targeting someone.
                if (mainShorts.length > 0) {
                    const shortSkill = mainShorts[0];
                    const isSelfOnly = shortSkill.id === 'holy_sheltron' || shortSkill.id === 'bloodwhetting';
                    if (!isSelfOnly && !isDuplicate(shortSkill.id, mit.time, mit.targetId)) {
                        migrated.push({
                            ...mit,
                            id: genId(),
                            mitigationId: shortSkill.id,
                            duration: shortSkill.duration
                        });
                    }
                }

                // If the new job ALSO has sub targeted buffs, add ALL of them (e.g. Oblation, Intervention, Nascent)
                subTargeteds.forEach(sub => {
                    if (!isDuplicate(sub.id, mit.time, mit.targetId)) {
                        migrated.push({
                            ...mit,
                            id: genId(),
                            mitigationId: sub.id,
                            duration: sub.duration
                        });
                    }
                });

                continue; // Handled specially
            }

            // Healer A: Old skill is main barrier (bh_120_a e.g. Panhaima).
            // When going Sage -> Scholar, we convert to Seraph, but we also want to add Illumination (bh_sub_a).
            if (oldDef.family === 'bh_120_a') {
                const mainBarriers = replacementSkills;
                const subShields = findByFamily('bh_sub_a'); // Fey Illum + Consolation

                if (mainBarriers.length > 0 && !isDuplicate(mainBarriers[0].id, mit.time, mit.targetId)) {
                    migrated.push({
                        ...mit,
                        id: genId(),
                        mitigationId: mainBarriers[0].id,
                        duration: mainBarriers[0].duration
                    });
                }

                // If it's Seraph, add Illum
                const illum = subShields.find(s => s.id === 'fey_illumination');
                if (illum && !isDuplicate(illum.id, mit.time, mit.targetId)) {
                    migrated.push({
                        ...mit,
                        id: genId(),
                        mitigationId: illum.id,
                        duration: illum.duration
                    });
                }
                // Consolation logic can be complex since it requires Seraph, 
                // but usually players plot Consolation manually or as a separate tag.
                // For direct family translation, we've handled the "set" via Illumination.
                continue;
            }

            // Standard direct family match
            // For role actions, we need exact base matching because a family could contain multiple (rampart vs reprisal)
            if (oldDef.family === 'role_action') {
                const baseName = oldDef.id.replace(`_${oldJobId}`, '');
                replacementSkills = replacementSkills.filter(s => s.id.startsWith(baseName));
            }

            // Just take the first matching skill of the same family
            if (replacementSkills.length > 0) {
                const targetNewSkill = replacementSkills[0];
                if (!isDuplicate(targetNewSkill.id, mit.time, mit.targetId)) {
                    migrated.push({
                        ...mit,
                        id: genId(),
                        mitigationId: targetNewSkill.id,
                        duration: targetNewSkill.duration
                    });
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
