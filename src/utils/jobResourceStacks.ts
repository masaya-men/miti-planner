import type { AppliedMitigation } from '../types';
import { getMitigationsFromStore } from '../hooks/useSkillsData';

/**
 * Aetherflow (SCH) - Gain times come from placed skills
 * - `aetherflow` (60s recast) and `dissipation` (180s recast) both give 3 stacks on use.
 * - Auto-insert on SCH join places 転化@t=1 + エーテルフロー@t=13, 73, 133...
 * - ユーザーが手動で配置/削除/ドラッグしたものも素直に gain times に反映される。
 */

/**
 * MODE 解決について:
 * 現在 resourceCost 構造（type / amount）はモード差分対象外と判断し、
 * 生 Mitigation の resourceCost を直接読んでいる。
 * 8.0 で resourceCost 構造が分岐する場合、関数シグネチャに party を追加し
 * resolveMitigation(def, getMode(owner)) 経由に切り替える。
 * Spec: docs/superpowers/specs/2026-04-30-skill-mode-infrastructure-design.md
 */

function getAetherflowGainTimes(upToTime: number, placedMitigations: AppliedMitigation[]): number[] {
    const times = placedMitigations
        .filter(m => (m.mitigationId === 'aetherflow' || m.mitigationId === 'dissipation') && m.time <= upToTime)
        .map(m => m.time);
    return Array.from(new Set(times)).sort((a, b) => a - b);
}

export function getAetherflowStacks(
    time: number,
    placedMitigations: AppliedMitigation[]
): number {
    const gainTimes = getAetherflowGainTimes(time, placedMitigations);
    if (gainTimes.length === 0) return 0;

    // Collect AF-consuming skills sorted by time
    const consumptions = placedMitigations
        .filter(m => {
            const def = getMitigationsFromStore().find(d => d.id === m.mitigationId);
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
            const def = getMitigationsFromStore().find(d => d.id === consumptions[consumeIdx].mitigationId);
            stacks = Math.max(0, stacks - (def?.resourceCost?.amount || 0));
            consumeIdx++;
        }

        // Gain: reset to 3
        stacks = 3;

        // Process consumptions between this gain and next gain (or target time)
        while (consumeIdx < consumptions.length && consumptions[consumeIdx].time < nextGainTime && consumptions[consumeIdx].time <= time) {
            const def = getMitigationsFromStore().find(d => d.id === consumptions[consumeIdx].mitigationId);
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
    // Collect Addersgall-consuming/granting skills (ケーラコレ等の消費 + リゾーマタの獲得) sorted by time
    const events = placedMitigations
        .filter(m => {
            const def = getMitigationsFromStore().find(d => d.id === m.mitigationId);
            return def?.resourceCost?.type === 'addersgall' || def?.resourceGain?.type === 'addersgall';
        })
        .filter(m => m.time <= time)
        .sort((a, b) => a.time - b.time);

    if (events.length === 0) return 3; // No consumption/gain, always 3

    // Simulate: start at 3, process events with regen
    // アダーガルは戦闘状態に関係なく常に20秒ごとにリチャージ
    // 初期ゲージ3個 = 最初のイベント前は常に最大なのでリチャージ起点は最初のイベント時刻
    let stacks = 3;
    let lastTime = events[0].time;
    let regenAccumulator = 0;

    for (const event of events) {
        const elapsed = event.time - lastTime;
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

        // Consume or gain
        const def = getMitigationsFromStore().find(d => d.id === event.mitigationId);
        if (def?.resourceCost?.type === 'addersgall') {
            stacks = Math.max(0, stacks - (def.resourceCost.amount || 0));
        } else if (def?.resourceGain?.type === 'addersgall') {
            stacks = Math.min(3, stacks + (def.resourceGain.amount || 0));
            if (stacks >= 3) regenAccumulator = 0; // 獲得で満タンになった場合も蓄積分は破棄
        }
        lastTime = event.time;
    }

    // Regen from last event to target time
    const finalElapsed = time - lastTime;
    const finalRegenTime = regenAccumulator + finalElapsed;
    const finalRegenGains = Math.floor(finalRegenTime / 20);
    stacks = Math.min(3, stacks + finalRegenGains);

    return stacks;
}

/**
 * Healing Lily (WHM) - Starts at 3, regenerates 1 every 20s in combat, max 3
 * Afflatus Solace / Afflatus Rapture costs 1
 */
export function getLilyStacks(
    time: number,
    placedMitigations: AppliedMitigation[]
): number {
    const consumptions = placedMitigations
        .filter(m => {
            const def = getMitigationsFromStore().find(d => d.id === m.mitigationId);
            return def?.resourceCost?.type === 'lily';
        })
        .filter(m => m.time <= time)
        .sort((a, b) => a.time - b.time);

    if (consumptions.length === 0) return 3;

    let stacks = 3;
    let lastTime = consumptions[0].time;
    let regenAccumulator = 0;

    for (const consumption of consumptions) {
        const elapsed = consumption.time - lastTime;
        const totalRegenTime = regenAccumulator + elapsed;
        const regenGains = Math.floor(totalRegenTime / 20);
        stacks = Math.min(3, stacks + regenGains);
        regenAccumulator = totalRegenTime % 20;

        if (stacks >= 3) {
            stacks = 3;
            regenAccumulator = 0;
        }

        const def = getMitigationsFromStore().find(d => d.id === consumption.mitigationId);
        stacks = Math.max(0, stacks - (def?.resourceCost?.amount || 0));
        lastTime = consumption.time;
    }

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
    // Summon Seraph requires the fairy to be available at the time of summoning.
    // Future Dissipations do not block summoning Seraph (as per real game mechanics).
    return isFairyAvailable(time, placedMitigations);
}
