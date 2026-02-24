import type { AppliedMitigation } from '../types';
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
