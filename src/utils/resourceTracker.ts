import type { AppliedMitigation, Mitigation } from '../types';
import { MITIGATIONS } from '../data/mockData';

/**
 * Aetherflow (SCH) - Pattern timings
 * Pattern 1 (転化先): 転化 at t=1 → 3 stacks, AF at t=13, 73, 133...  Seraph from t=31
 * Pattern 2 (転化後): AF at t=0, 60, 120...   Seraph from t=44
 */

function getAetherflowGainTimes(pattern: 1 | 2, upToTime: number, placedMitigations: AppliedMitigation[]): number[] {
    const times: number[] = [];
    if (pattern === 1) {
        // 転化 (Dissipation) at t=1 gives 3 stacks
        if (1 <= upToTime) times.push(1);
        // AF ability at t=13, then every 60s
        let t = 13;
        while (t <= upToTime) {
            times.push(t);
            t += 60;
        }
    } else {
        // AF at t=0, then every 60s
        let t = 0;
        while (t <= upToTime) {
            times.push(t);
            t += 60;
        }
    }

    // Add manually placed dissipation times
    const dissipationUses = placedMitigations.filter(m => m.mitigationId === 'dissipation' && m.time <= upToTime);
    for (const d of dissipationUses) {
        if (!times.includes(d.time)) {
            times.push(d.time);
        }
    }

    return times.sort((a, b) => a - b);
}

export function getAetherflowStacks(
    time: number,
    pattern: 1 | 2,
    placedMitigations: AppliedMitigation[]
): number {
    const gainTimes = getAetherflowGainTimes(pattern, time, placedMitigations);
    if (gainTimes.length === 0) return 0;

    // Collect AF-consuming skills sorted by time
    const consumptions = placedMitigations
        .filter(m => {
            const def = MITIGATIONS.find(d => d.id === m.mitigationId);
            return def?.resourceCost?.type === 'aetherflow';
        })
        .filter(m => m.time <= time)
        .sort((a, b) => a.time - b.time);

    // Simulate stacks over time
    let stacks = 0;
    let consumeIdx = 0;

    for (let i = 0; i < gainTimes.length; i++) {
        const gainTime = gainTimes[i];
        const nextGainTime = i < gainTimes.length - 1 ? gainTimes[i + 1] : time + 1;

        // Process consumptions before this gain
        while (consumeIdx < consumptions.length && consumptions[consumeIdx].time < gainTime) {
            const def = MITIGATIONS.find(d => d.id === consumptions[consumeIdx].mitigationId);
            stacks = Math.max(0, stacks - (def?.resourceCost?.amount || 0));
            consumeIdx++;
        }

        // Gain: reset to 3
        stacks = 3;

        // Process consumptions between this gain and next gain (or target time)
        while (consumeIdx < consumptions.length && consumptions[consumeIdx].time < nextGainTime && consumptions[consumeIdx].time <= time) {
            const def = MITIGATIONS.find(d => d.id === consumptions[consumeIdx].mitigationId);
            stacks = Math.max(0, stacks - (def?.resourceCost?.amount || 0));
            consumeIdx++;
        }
    }

    return stacks;
}

/**
 * Addersgall (SGE) - Starts at 3, regenerates 1 every 20s, max 3
 * Kerachole costs 1
 */
export function getAddersgallStacks(
    time: number,
    placedMitigations: AppliedMitigation[]
): number {
    // Collect Addersgall-consuming skills sorted by time
    const consumptions = placedMitigations
        .filter(m => {
            const def = MITIGATIONS.find(d => d.id === m.mitigationId);
            return def?.resourceCost?.type === 'addersgall';
        })
        .filter(m => m.time <= time)
        .sort((a, b) => a.time - b.time);

    if (consumptions.length === 0) return 3; // No consumption, always 3

    // Simulate: start at 3, process consumptions with regen
    let stacks = 3;
    let lastTime = 0; // combat start
    let regenAccumulator = 0; // partial regen time

    for (const consumption of consumptions) {
        // Calculate regen between lastTime and consumption time
        const elapsed = consumption.time - lastTime;
        const totalRegenTime = regenAccumulator + elapsed;
        const regenGains = Math.floor(totalRegenTime / 20);
        stacks = Math.min(3, stacks + regenGains);

        // If stacks were at max during part of the regen period, adjust accumulator
        // Simplified: just track remainder
        regenAccumulator = totalRegenTime % 20;

        // If stacks hit max, reset accumulator (regen pauses at max)
        if (stacks >= 3) {
            stacks = 3;
            regenAccumulator = 0;
        }

        // Consume
        const def = MITIGATIONS.find(d => d.id === consumption.mitigationId);
        stacks = Math.max(0, stacks - (def?.resourceCost?.amount || 0));
        lastTime = consumption.time;
    }

    // Regen from last consumption to target time
    const finalElapsed = time - lastTime;
    const finalRegenTime = regenAccumulator + finalElapsed;
    const finalRegenGains = Math.floor(finalRegenTime / 20);
    stacks = Math.min(3, stacks + finalRegenGains);

    return stacks;
}

/**
 * Check if the fairy is actively responding to commands at `time`.
 */
export function isFairyAvailable(time: number, placedMitigations: AppliedMitigation[]): boolean {
    const activeDissipations = placedMitigations.filter(
        m => m.mitigationId === 'dissipation' && time >= m.time && time < m.time + m.duration
    );
    if (activeDissipations.length > 0) return false;

    return true;
}

/**
 * Summon Seraph availability (must not overlap its duration with Dissipation)
 */
export function canUseSummonSeraph(time: number, placedMitigations: AppliedMitigation[]): boolean {
    const duration = 22; // Seraph duration
    const end = time + duration;

    const activeDissipations = placedMitigations.filter(m => m.mitigationId === 'dissipation');
    for (const d of activeDissipations) {
        if (!(end <= d.time || time >= d.time + d.duration)) {
            return false;
        }
    }

    return true;
}

/**
 * Get remaining charges for a charge-based skill at a given time.
 * Two modes:
 *   1. Window charges (has `requires`): counts uses within active prerequisite window
 *   2. Recast charges (no `requires`): simulates game charge system (start at max, regen per cooldown)
 */
export function getRemainingCharges(
    mitigationId: string,
    selectedTime: number,
    activeMitigations: AppliedMitigation[]
): number {
    const def = MITIGATIONS.find(d => d.id === mitigationId);
    if (!def || !def.maxCharges) return -1; // -1 = not a charge skill

    if (def.requires) {
        // Window charges: count uses within the active prerequisite window
        const parentInstances = activeMitigations.filter(am => am.mitigationId === def.requires);
        // Find the parent window that covers selectedTime
        const activeParent = parentInstances.find(p => {
            return selectedTime >= p.time && selectedTime < p.time + p.duration;
        });
        if (!activeParent) return def.maxCharges; // No active parent = full charges (will be hidden anyway)

        // Count how many times this skill is placed within this parent window
        const usedInWindow = activeMitigations.filter(am => {
            if (am.mitigationId !== mitigationId) return false;
            return am.time >= activeParent.time && am.time < activeParent.time + activeParent.duration;
        }).length;

        return Math.max(0, def.maxCharges - usedInWindow);
    } else {
        // Recast charges: simulate game charge system
        // Start at maxCharges, consume on use, regen one per cooldown period
        const uses = activeMitigations
            .filter(am => am.mitigationId === mitigationId && am.time <= selectedTime)
            .sort((a, b) => a.time - b.time);

        if (uses.length === 0) return def.maxCharges;

        // Simulate charge state over time
        let charges = def.maxCharges;
        let rechargeTimer = 0; // time accumulating toward next charge

        // Process events chronologically
        let lastTime = 0;
        for (const use of uses) {
            // Accumulate recharge time from lastTime to use.time
            const elapsed = use.time - lastTime;
            if (charges < def.maxCharges) {
                rechargeTimer += elapsed;
                const recharged = Math.floor(rechargeTimer / def.cooldown);
                charges = Math.min(def.maxCharges, charges + recharged);
                rechargeTimer = rechargeTimer % def.cooldown;
                if (charges >= def.maxCharges) rechargeTimer = 0;
            }
            // Consume
            charges = Math.max(0, charges - 1);
            if (charges < def.maxCharges && rechargeTimer === 0) {
                // Start recharge timer from this use
            }
            lastTime = use.time;
        }

        // Accumulate recharge from last use to selectedTime
        const finalElapsed = selectedTime - lastTime;
        if (charges < def.maxCharges) {
            rechargeTimer += finalElapsed;
            const recharged = Math.floor(rechargeTimer / def.cooldown);
            charges = Math.min(def.maxCharges, charges + recharged);
        }

        return charges;
    }
}

/**
 * Validates if a mitigation can be placed at a specific time.
 * This is the shared logic used by both the MitigationSelector (adding new) 
 * and Timeline (dragging existing).
 */
export function validateMitigationPlacement(
    m: Mitigation,
    selectedTime: number,
    activeMitigations: AppliedMitigation[],
    schAetherflowPattern: 1 | 2,
    t: (key: string, options?: any) => string,
    // Optional parameter to ignore a specific instance ID during overlap checks (useful for drag & drop)
    ignoreInstanceId?: string
): { available: boolean; warning?: boolean; message?: string; badge?: string; badgeColor?: string } {

    // Filter out the instance being moved if dragging
    const relevantMitigations = ignoreInstanceId
        ? activeMitigations.filter(am => am.id !== ignoreInstanceId)
        : activeMitigations;

    // Fairy-dependent skill restrictions (Dissipation dismisses fairy)
    if (m.id === 'fey_illumination' && !isFairyAvailable(selectedTime, relevantMitigations)) {
        return { available: false, message: t('mitigation.unavailable_dissipation', 'Unavailable (Dissipation)') };
    }
    if (m.id === 'summon_seraph' && !canUseSummonSeraph(selectedTime, relevantMitigations)) {
        return { available: false, message: t('mitigation.unavailable_dissipation_dup', 'Unavailable (Dissipation)') };
    }

    // Resource cost check (Aetherflow / Addersgall)
    if (m.resourceCost) {
        let stacks = 0;
        if (m.resourceCost.type === 'aetherflow') {
            stacks = getAetherflowStacks(selectedTime, schAetherflowPattern, relevantMitigations);
        } else if (m.resourceCost.type === 'addersgall') {
            stacks = getAddersgallStacks(selectedTime, relevantMitigations);
        }
        const badge = `×${stacks}`;
        if (stacks < m.resourceCost.amount) {
            const label = m.resourceCost.type === 'aetherflow'
                ? t('mitigation.no_aetherflow', 'No Aetherflow')
                : t('mitigation.no_addersgall', 'No Addersgall');
            return { available: false, message: label, badge, badgeColor: 'red' };
        }
    }

    // Charge check (maxCharges) — charge system handles cooldown internally
    if (m.maxCharges) {
        const remaining = getRemainingCharges(m.id, selectedTime, relevantMitigations);
        const badge = `${remaining}/${m.maxCharges}`;
        if (remaining <= 0) {
            const label = t('mitigation.no_charges', 'No charges');
            return { available: false, message: label, badge, badgeColor: 'red' };
        }
        return { available: true, badge, badgeColor: remaining <= 1 ? 'amber' : 'cyan' };
    }

    // Cooldown check (non-charge skills only)
    const getSharedCooldownIds = (id: string) => {
        if (id === 'bloodwhetting' || id === 'nascent_flash') {
            return ['bloodwhetting', 'nascent_flash'];
        }
        return [id];
    };

    const sharedIds = getSharedCooldownIds(m.id);

    const sameSkillUses = relevantMitigations
        .filter(am => sharedIds.includes(am.mitigationId))
        .sort((a, b) => a.time - b.time);

    if (sameSkillUses.length > 0) {
        // Forward check: is the skill still on cooldown from a previous use?
        const prevUses = sameSkillUses.filter(u => u.time <= selectedTime);
        if (prevUses.length > 0) {
            const lastPrev = prevUses[prevUses.length - 1];
            const cdEnd = lastPrev.time + m.cooldown;
            if (selectedTime < cdEnd) {
                const remaining = Math.ceil(cdEnd - selectedTime);
                const label = t('mitigation.cd_remaining', { seconds: remaining, defaultValue: `CD ${remaining}s` });
                return { available: false, message: label };
            }
        }

        // Backward check: would this placement's cooldown overlap with a future use?
        const nextUses = sameSkillUses.filter(u => u.time > selectedTime);
        if (nextUses.length > 0) {
            const firstNext = nextUses[0];
            if (selectedTime + m.cooldown > firstNext.time) {
                const overlap = Math.ceil((selectedTime + m.cooldown) - firstNext.time);
                // When dragging, we want to block if we overlap with a future CD
                if (ignoreInstanceId) {
                    const label = t('mitigation.cd_overlap', { seconds: overlap, defaultValue: `CD overlap (${overlap}s)` });
                    return { available: false, message: label };
                }

                // If just selecting, show warning
                const gap = Math.floor(firstNext.time - selectedTime);
                const label = t('mitigation.next_at', { time: firstNext.time, gap, defaultValue: `Next at ${firstNext.time}s (${gap}s gap)` });
                // Get resource badge if applicable
                const resourceBadge = m.resourceCost ? (() => {
                    let stacks = 0;
                    if (m.resourceCost!.type === 'aetherflow') stacks = getAetherflowStacks(selectedTime, schAetherflowPattern, relevantMitigations);
                    else if (m.resourceCost!.type === 'addersgall') stacks = getAddersgallStacks(selectedTime, relevantMitigations);
                    return { badge: `×${stacks}`, badgeColor: stacks <= 1 ? 'amber' as const : 'cyan' as const };
                })() : {};
                return { available: true, warning: true, message: label, ...resourceBadge };
            }
        }
    }

    // If we have resource cost, return with badge (passed the resource check earlier)
    if (m.resourceCost) {
        let stacks = 0;
        if (m.resourceCost.type === 'aetherflow') stacks = getAetherflowStacks(selectedTime, schAetherflowPattern, relevantMitigations);
        else if (m.resourceCost.type === 'addersgall') stacks = getAddersgallStacks(selectedTime, relevantMitigations);
        const badge = `×${stacks}`;
        return { available: true, badge, badgeColor: stacks <= 1 ? 'amber' : 'cyan' };
    }

    return { available: true };
}
