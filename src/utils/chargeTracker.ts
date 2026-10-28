import type { AppliedMitigation, Mitigation } from '../types';
import { getMitigationsFromStore } from '../hooks/useSkillsData';
import { useMitigationStore } from '../store/useMitigationStore';

/**
 * コンテンツレベルを加味した実効最大チャージ数。
 * chargeMinLevel を持つ技は、現在のコンテンツ level がそれ未満なら 1 チャージ扱い
 * (例: ディヴァインベニゾン/星天交差は Lv88 の特性で初めて 2 チャージになる)。
 * chargeMinLevel を持たない技は maxCharges をそのまま返す(レベル非依存)。
 */
export function effectiveMaxCharges(def: Pick<Mitigation, 'maxCharges' | 'chargeMinLevel'>): number {
    const max = def.maxCharges ?? 0;
    if (def.chargeMinLevel != null) {
        const level = useMitigationStore.getState().currentLevel;
        if (level < def.chargeMinLevel) return 1;
    }
    return max;
}

/**
 * Get remaining charges for a charge-based skill at a given time.
 * Two modes:
 * 1. Window charges (has `requires`): counts uses within active prerequisite window
 * 2. Recast charges (no `requires`): simulates game charge system (start at max, regen per cooldown)
 */
export function getRemainingCharges(
    mitigationId: string,
    selectedTime: number,
    activeMitigations: AppliedMitigation[]
): number {
    const def = getMitigationsFromStore().find(d => d.id === mitigationId);
    if (!def || !def.maxCharges) return -1; // -1 = not a charge skill
    const maxCh = effectiveMaxCharges(def); // レベル連動の実効チャージ数(<chargeMinLevel は 1)

    if (def.requires) {
        // Window charges: count uses within the active prerequisite window
        const parentInstances = activeMitigations.filter(am => am.mitigationId === def.requires);
        const reqWindow = def.requiresWindow;
        // Find the parent window that covers selectedTime
        const activeParent = parentInstances.find(p => {
            const window = reqWindow ?? p.duration;
            return selectedTime >= p.time && selectedTime < p.time + window;
        });
        if (!activeParent) return maxCh; // No active parent = full charges (will be hidden anyway)

        // Count how many times this skill is placed within this parent window
        const windowDuration = reqWindow ?? activeParent.duration;
        const usedInWindow = activeMitigations.filter(am => {
            if (am.mitigationId !== mitigationId) return false;
            return am.time >= activeParent.time && am.time < activeParent.time + windowDuration;
        }).length;

        return Math.max(0, maxCh - usedInWindow);
    } else {
        // Recast charges: simulate game charge system (chargeStateAt に切り出し済み)
        const uses = activeMitigations
            .filter(am => am.mitigationId === mitigationId)
            .map(am => am.time);
        return chargeStateAt(def, uses, selectedTime).charges;
    }
}

/**
 * recast 方式チャージ技の充電シミュレーション本体。
 * maxCharges(レベル連動の実効数)から始め、使うたびに 1 消費、recast 秒ごとに 1 回復する。
 * `uses` のうち t 以下の使用(t ちょうどの使用も消費済み)を時系列で処理し、t 時点の
 * 残りチャージと「次の 1 チャージまでに溜まった秒(rechargeTimer)」を返す。満タンなら rechargeTimer=0。
 * getRemainingCharges と スプシのリキャスト線(sheetGeometry.cooldownSpans)が共用する。
 */
export function chargeStateAt(
    def: Pick<Mitigation, 'maxCharges' | 'chargeMinLevel' | 'recast'>,
    uses: readonly number[],
    t: number
): { charges: number; rechargeTimer: number } {
    const maxCh = effectiveMaxCharges(def);
    const sorted = uses.filter(u => u <= t).sort((a, b) => a - b);
    if (sorted.length === 0) return { charges: maxCh, rechargeTimer: 0 };

    let charges = maxCh;
    let rechargeTimer = 0; // time accumulating toward next charge

    // Process events chronologically
    let lastTime = 0;
    for (const useTime of sorted) {
        // Accumulate recharge time from lastTime to use.time
        const elapsed = useTime - lastTime;
        if (charges < maxCh) {
            rechargeTimer += elapsed;
            const recharged = Math.floor(rechargeTimer / def.recast);
            charges = Math.min(maxCh, charges + recharged);
            rechargeTimer = rechargeTimer % def.recast;
            if (charges >= maxCh) rechargeTimer = 0;
        }
        // Consume
        charges = Math.max(0, charges - 1);
        lastTime = useTime;
    }

    // Accumulate recharge from last use to t
    const finalElapsed = t - lastTime;
    if (charges < maxCh) {
        rechargeTimer += finalElapsed;
        const recharged = Math.floor(rechargeTimer / def.recast);
        charges = Math.min(maxCh, charges + recharged);
        rechargeTimer = rechargeTimer % def.recast;
    }
    if (charges >= maxCh) rechargeTimer = 0;

    return { charges, rechargeTimer };
}

/**
 * recast 方式チャージ技で、selectedTime 時点から「次の 1 チャージが回復するまでの秒数」を返す。
 * - チャージ技でない / requires(窓)方式 / recast<=0 / すでに満タン → 0 (= 表示しない)
 * - getRemainingCharges と同じ充電シミュレーションを行い、最後に充電タイマーの残りを秒で返す。
 * モーダルの「次チャージ ○○秒」表示用 (通常技の「CD ○○秒」に相当)。
 */
export function getTimeUntilNextCharge(
    mitigationId: string,
    selectedTime: number,
    activeMitigations: AppliedMitigation[]
): number {
    const def = getMitigationsFromStore().find(d => d.id === mitigationId);
    if (!def || !def.maxCharges) return 0;
    if (def.requires) return 0; // 窓(prerequisite)方式は recast 概念なし
    if (!def.recast || def.recast <= 0) return 0;

    const maxCh = effectiveMaxCharges(def);
    const uses = activeMitigations
        .filter(am => am.mitigationId === mitigationId && am.time <= selectedTime)
        .sort((a, b) => a.time - b.time);
    if (uses.length === 0) return 0;

    // getRemainingCharges と同一のシミュレーション。最後に充電タイマー残量から秒数を算出。
    let charges = maxCh;
    let rechargeTimer = 0;
    let lastTime = 0;
    for (const use of uses) {
        const elapsed = use.time - lastTime;
        if (charges < maxCh) {
            rechargeTimer += elapsed;
            const recharged = Math.floor(rechargeTimer / def.recast);
            charges = Math.min(maxCh, charges + recharged);
            rechargeTimer = rechargeTimer % def.recast;
            if (charges >= maxCh) rechargeTimer = 0;
        }
        charges = Math.max(0, charges - 1);
        lastTime = use.time;
    }
    const finalElapsed = selectedTime - lastTime;
    if (charges < maxCh) {
        rechargeTimer += finalElapsed;
        const recharged = Math.floor(rechargeTimer / def.recast);
        charges = Math.min(maxCh, charges + recharged);
        rechargeTimer = rechargeTimer % def.recast;
    }
    if (charges >= maxCh) return 0;
    return Math.ceil(def.recast - rechargeTimer);
}
