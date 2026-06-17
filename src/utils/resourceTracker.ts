import type { AppliedMitigation, Mitigation } from '../types';
import { getMitigationsFromStore } from '../hooks/useSkillsData';
import { useMitigationStore } from '../store/useMitigationStore';

/**
 * 共有リキャストの技グループを返す(例: bloodwhetting / nascent_flash は同一CD)。
 */
export function getSharedCooldownIds(id: string): string[] {
    if (id === 'bloodwhetting' || id === 'nascent_flash') {
        return ['bloodwhetting', 'nascent_flash'];
    }
    return [id];
}

/**
 * プラン内の「同一オーナー・同一共有CDグループ・非チャージ技」で
 * リキャストが被る(t2 < t1 + recast)インスタンスの id 集合を返す。
 * 競合は配置時の1回フラグではなく、この関数でデータから常に導出する。
 */
export function findSameSkillCdConflicts(mitigations: AppliedMitigation[]): Set<string> {
    const defs = getMitigationsFromStore();
    const defById = new Map<string, Mitigation>(defs.map(d => [d.id, d]));

    // owner + 共有CDグループ で束ねる
    const groups = new Map<string, AppliedMitigation[]>();
    for (const am of mitigations) {
        const def = defById.get(am.mitigationId);
        if (!def) continue;
        if (def.maxCharges) continue;                  // チャージ技は対象外
        if (!def.recast || def.recast <= 0) continue;  // リキャスト概念なしは対象外
        const groupKey = `${am.ownerId}::${getSharedCooldownIds(am.mitigationId).slice().sort().join('|')}`;
        let arr = groups.get(groupKey);
        if (!arr) { arr = []; groups.set(groupKey, arr); }
        arr.push(am);
    }

    const conflicts = new Set<string>();
    for (const list of groups.values()) {
        list.sort((a, b) => a.time - b.time);
        for (let i = 0; i < list.length - 1; i++) {
            const a = list[i];
            const b = list[i + 1];
            const recast = defById.get(a.mitigationId)?.recast ?? 0;
            if (b.time < a.time + recast) { // a のリキャスト中に b が入る = 競合
                conflicts.add(a.id);
                conflicts.add(b.id);
            }
        }
    }
    return conflicts;
}

/**
 * コンテンツレベルを加味した実効最大チャージ数。
 * chargeMinLevel を持つ技は、現在のコンテンツ level がそれ未満なら 1 チャージ扱い
 * (例: ディヴァインベニゾン/星天交差は Lv88 の特性で初めて 2 チャージになる)。
 * chargeMinLevel を持たない技は maxCharges をそのまま返す(レベル非依存)。
 */
function effectiveMaxCharges(def: Pick<Mitigation, 'maxCharges' | 'chargeMinLevel'>): number {
    const max = def.maxCharges ?? 0;
    if (def.chargeMinLevel != null) {
        const level = useMitigationStore.getState().currentLevel;
        if (level < def.chargeMinLevel) return 1;
    }
    return max;
}

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
    // Collect Addersgall-consuming skills sorted by time
    const consumptions = placedMitigations
        .filter(m => {
            const def = getMitigationsFromStore().find(d => d.id === m.mitigationId);
            return def?.resourceCost?.type === 'addersgall';
        })
        .filter(m => m.time <= time)
        .sort((a, b) => a.time - b.time);

    if (consumptions.length === 0) return 3; // No consumption, always 3

    // Simulate: start at 3, process consumptions with regen
    // アダーガルは戦闘状態に関係なく常に20秒ごとにリチャージ
    // 初期ゲージ3個 = 最初の消費前は常に最大なのでリチャージ起点は最初の消費時刻
    let stacks = 3;
    let lastTime = consumptions[0].time;
    let regenAccumulator = 0;

    for (const consumption of consumptions) {
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
        const def = getMitigationsFromStore().find(d => d.id === consumption.mitigationId);
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
        // Recast charges: simulate game charge system
        // Start at maxCh, consume on use, regen one per cooldown period
        const uses = activeMitigations
            .filter(am => am.mitigationId === mitigationId && am.time <= selectedTime)
            .sort((a, b) => a.time - b.time);

        if (uses.length === 0) return maxCh;

        // Simulate charge state over time
        let charges = maxCh;
        let rechargeTimer = 0; // time accumulating toward next charge

        // Process events chronologically
        let lastTime = 0;
        for (const use of uses) {
            // Accumulate recharge time from lastTime to use.time
            const elapsed = use.time - lastTime;
            if (charges < maxCh) {
                rechargeTimer += elapsed;
                const recharged = Math.floor(rechargeTimer / def.recast);
                charges = Math.min(maxCh, charges + recharged);
                rechargeTimer = rechargeTimer % def.recast;
                if (charges >= maxCh) rechargeTimer = 0;
            }
            // Consume
            charges = Math.max(0, charges - 1);
            if (charges < maxCh && rechargeTimer === 0) {
                // Start recharge timer from this use
            }
            lastTime = use.time;
        }

        // Accumulate recharge from last use to selectedTime
        const finalElapsed = selectedTime - lastTime;
        if (charges < maxCh) {
            rechargeTimer += finalElapsed;
            const recharged = Math.floor(rechargeTimer / def.recast);
            charges = Math.min(maxCh, charges + recharged);
        }

        return charges;
    }
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

/**
 * Validates if a mitigation can be placed at a specific time.
 * This is the shared logic used by both the MitigationSelector (adding new)
 * and Timeline (dragging existing).
 */
export function validateMitigationPlacement(
    m: Mitigation,
    selectedTime: number,
    activeMitigations: AppliedMitigation[],
    t: (key: string, options?: any) => string,
    // Optional parameter to ignore a specific instance ID during overlap checks (useful for drag & drop)
    ignoreInstanceId?: string
): { available: boolean; warning?: boolean; message?: string; shortMessage?: string; badge?: string; badgeColor?: string; conflictInstanceId?: string; recastInfo?: string; conflictOverride?: boolean } {

    // Filter out the instance being moved if dragging
    const relevantMitigations = ignoreInstanceId
        ? activeMitigations.filter(am => am.id !== ignoreInstanceId)
        : activeMitigations;

    // 👆 追加ここまで

    // 👇 AST ドロー専用: 直前のドローと交互制約 (同種別の連続使用は不可)
    // ゲーム内仕様: アストラル → アンブラル → アストラル → ... と必ず交互。 時間経過で復活しない。
    if (m.id === 'astral_draw' || m.id === 'umbral_draw') {
        const drawsBeforeNow = relevantMitigations
            .filter(am => am.mitigationId === 'astral_draw' || am.mitigationId === 'umbral_draw')
            .filter(am => am.time < selectedTime)
            .sort((a, b) => b.time - a.time);
        if (drawsBeforeNow.length > 0 && drawsBeforeNow[0].mitigationId === m.id) {
            const expectedId = m.id === 'astral_draw' ? 'umbral_draw' : 'astral_draw';
            const expectedDef = getMitigationsFromStore().find(d => d.id === expectedId);
            const expectedNameObj = expectedDef ? expectedDef.name : { ja: '反対のドロー', en: 'Opposite Draw' };
            const lang = t('lang_info', 'ja');
            const expectedName = (lang === 'en' || lang === 'en-US' || !expectedNameObj.ja) ? expectedNameObj.en : expectedNameObj.ja;
            return {
                available: false,
                message: t('mitigation.draw_alternate_required', { expected: expectedName, defaultValue: `次は${expectedName}` })
            };
        }
    }
    // 👆 追加ここまで

    // 👇 ここから追加：前提スキル（requires）の完全ブロック制約
    if (m.requires) {
        // AST カード専用: 最新のドローが対応する種別か (手札は次のドローまで保持される仕様)
        if (m.requires === 'astral_draw' || m.requires === 'umbral_draw') {
            const drawsBeforeNow = relevantMitigations
                .filter(am => am.mitigationId === 'astral_draw' || am.mitigationId === 'umbral_draw')
                .filter(am => am.time <= selectedTime)
                .sort((a, b) => b.time - a.time);
            if (drawsBeforeNow.length === 0 || drawsBeforeNow[0].mitigationId !== m.requires) {
                const parentDef = getMitigationsFromStore().find(d => d.id === m.requires);
                const parentNameObj = parentDef ? parentDef.name : { ja: '前提スキル', en: 'Prerequisite' };
                const lang = t('lang_info', 'ja');
                const parentNameStr = (lang === 'en' || lang === 'en-US' || !parentNameObj.ja) ? parentNameObj.en : parentNameObj.ja;
                return {
                    available: false,
                    message: t('mitigation.requires_parent', { parent: parentNameStr, defaultValue: `${parentNameStr}の効果中のみ使用可能` })
                };
            }
            // 同ドローセッション内の単発使用制約: 最新ドロー以降に同カードを既に使っていれば配置不可
            // (ゲーム仕様: 各カードは 1 ドローで 1 枚配布され、 1 回しか使えない)
            const latestDrawTime = drawsBeforeNow[0].time;
            const cardUsedAfterLatestDraw = relevantMitigations.some(am =>
                am.mitigationId === m.id &&
                am.time >= latestDrawTime &&
                am.time < selectedTime
            );
            if (cardUsedAfterLatestDraw) {
                return { available: false };
            }
            // AST カードは既存の parentInstances ベースの判定をスキップ
        } else {
            // 配置済みの軽減の中から、前提スキル（例：ニュートラルセクト）を探す
            const parentInstances = relevantMitigations.filter(am => am.mitigationId === m.requires);

            // 移動させようとしている時間が、前提スキルの効果時間内に収まっているかチェック
            // requiresWindow がある場合はそちらを使用（例: 金剛周天は金剛の極意の30秒窓）
            const requiresWindow = m.requiresWindow;
            let isActiveParent = parentInstances.some(p => {
                const window = requiresWindow ?? p.duration;
                return selectedTime >= p.time && selectedTime < (p.time + window);
            });

            // AST SpecialCase: Horoscope also allows Helios skills (which normally require Neutral Sect)
            // This check must run even if Neutral Sect (parentInstances) is empty.
            if (!isActiveParent && m.requires === 'neutral_sect' && (m.id === 'aspected_helios' || m.id === 'helios_conjunction')) {
                const horoscopeInstances = relevantMitigations.filter(am => am.mitigationId === 'horoscope');
                isActiveParent = horoscopeInstances.some(h => selectedTime >= h.time && selectedTime < (h.time + h.duration));
            }

            // 収まっていない場合は、エラーメッセージを返して配置をブロック！
            if (!isActiveParent) {
                const parentDef = getMitigationsFromStore().find(d => d.id === m.requires);
                // Fix: parentDef.name is a LocalizedString object { ja: string, en: string }.
                // We must extract the string based on context or use i18next's capabilities.
                const parentNameObj = parentDef ? parentDef.name : { ja: '前提スキル', en: 'Prerequisite' };
                const lang = t('lang_info', 'ja');
                const parentNameStr = (lang === 'en' || lang === 'en-US' || !parentNameObj.ja) ? parentNameObj.en : parentNameObj.ja;

                let message = t('mitigation.requires_parent', { parent: parentNameStr, defaultValue: `${parentNameStr}の効果中のみ使用可能` });
                if (m.requires === 'neutral_sect' && (m.id === 'aspected_helios' || m.id === 'helios_conjunction')) {
                    message = t('mitigation.ast_helios_requires', 'ニュートラルセクトまたはホロスコープの効果中のみ使用可能');
                }

                return { available: false, message };
            }
        }
    }
    // 👆 追加ここまで

    // Combat-only skills check (Dissipation, Aetherpact, Seraphism)
    if (m.id === 'dissipation' || m.id === 'aetherpact' || m.id === 'seraphism') {
        if (selectedTime < 0) {
            return { available: false, message: t('mitigation.combat_only', 'Available only during combat') };
        }
    }

    // Fairy-dependent skill restrictions (Dissipation dismisses fairy)
    if (m.requiresFairy) {
        // We only check if the fairy is available at the activation time.
        // Even if the fairy is dismissed later (e.g., by Dissipation), the skill remains active.
        if (m.id === 'summon_seraph') {
            if (!canUseSummonSeraph(selectedTime, relevantMitigations)) {
                return { available: false, message: t('mitigation.unavailable_dissipation', 'フェアリ一不在 (転化中)') };
            }
            // Check for future Dissipations during the effect duration (22s)
            const seraphDuration = 22;
            const hasFutureDissipation = relevantMitigations.some(am => 
                am.mitigationId === 'dissipation' && 
                am.time > selectedTime && 
                am.time < selectedTime + seraphDuration
            );
            if (hasFutureDissipation) {
                return { 
                    available: true, 
                    warning: true, 
                    message: t('mitigation.seraph_cancels_dissipation', '効果中の転化を削除して設置します') 
                };
            }
        } else {
            if (!isFairyAvailable(selectedTime, relevantMitigations)) {
                return { available: false, message: t('mitigation.unavailable_dissipation', 'フェアリ一不在 (転化中)') };
            }
        }
    }

    // Dissipation is blocked while Seraph is active (requires normal fairy)
    if (m.id === 'dissipation') {
        const isSeraphActive = relevantMitigations.some(am => am.mitigationId === 'summon_seraph' && selectedTime >= am.time && selectedTime < am.time + am.duration);
        if (isSeraphActive) {
            return { available: false, message: t('mitigation.requires_fairy_not_seraph', 'フェアリーが必要なため、セラフィム中は使用できません') };
        }

        // Seraphism is canceled by Dissipation (Warning)
        const isSeraphismActive = relevantMitigations.some(am => am.mitigationId === 'seraphism' && selectedTime >= am.time && selectedTime < am.time + am.duration);
        if (isSeraphismActive) {
            return { 
                available: true, 
                warning: true, 
                message: t('mitigation.cancels_seraphism', '転化を使用するとセラフィズムが解除されます') 
            };
        }
    }

    // Resource cost check (Aetherflow / Addersgall / Lily)
    if (m.resourceCost) {
        let stacks = 0;
        if (m.resourceCost.type === 'aetherflow') {
            stacks = getAetherflowStacks(selectedTime, relevantMitigations);
        } else if (m.resourceCost.type === 'addersgall') {
            stacks = getAddersgallStacks(selectedTime, relevantMitigations);
        } else if (m.resourceCost.type === 'lily') {
            stacks = getLilyStacks(selectedTime, relevantMitigations);
        }
        const badge = `×${stacks}`;
        if (stacks < m.resourceCost.amount) {
            const label = m.resourceCost.type === 'aetherflow'
                ? t('mitigation.no_aetherflow', 'No Aetherflow')
                : m.resourceCost.type === 'addersgall'
                ? t('mitigation.no_addersgall', 'No Addersgall')
                : t('mitigation.no_lily', 'No Lily');
            return { available: false, message: label, badge, badgeColor: 'red' };
        }
    }

    // Charge check (maxCharges) — charge system handles cooldown internally
    if (m.maxCharges) {
        // レベル連動: chargeMinLevel 未満のコンテンツでは実効 1 チャージ(例: Lv88未満のディヴァインベニゾン/星天交差)。
        const effMax = effectiveMaxCharges(m);
        const remaining = getRemainingCharges(m.id, selectedTime, relevantMitigations);
        // recast 方式チャージ技の「次チャージまでの秒数」(窓方式は 0)。
        const toNextCharge = getTimeUntilNextCharge(m.id, selectedTime, relevantMitigations);
        // 実効 1 チャージ (Lv ゲートで 1 になった技、 または窓方式の単発技) は
        // チャージ概念がユーザーにとって不自然なので、 バッジを出さず通常リキャスト技と同じ扱い。
        // recast 方式ならリキャスト中は通常技と同じ「CD ○○秒」を出す(従来は文言が一切出ず原因不明だった)。
        if (effMax === 1) {
            if (remaining <= 0) {
                if (toNextCharge > 0) {
                    const label = t('mitigation.cd_remaining', { seconds: toNextCharge, defaultValue: `CD ${toNextCharge}s` });
                    return { available: false, message: label };
                }
                return { available: false };
            }
            return { available: true };
        }
        const badge = `${remaining}/${effMax}`;
        if (remaining <= 0) {
            // 全チャージ消費中。 次の 1 チャージまでの秒数を出す(従来は「No charges」のみで秒数が見えなかった)。
            const label = toNextCharge > 0
                ? t('mitigation.next_charge_in', { seconds: toNextCharge, defaultValue: `次チャージ ${toNextCharge}秒` })
                : t('mitigation.no_charges', 'No charges');
            return { available: false, message: label, badge, badgeColor: 'red' };
        }
        // まだ置ける(1 個以上残)。 回復中(toNextCharge>0)なら次チャージまでの秒数を情報として併記。
        // available は true のまま(=ブロックしない)、 recastInfo は中立色で表示する。
        const recastInfo = toNextCharge > 0
            ? t('mitigation.next_charge_in', { seconds: toNextCharge, defaultValue: `次チャージ ${toNextCharge}秒` })
            : undefined;
        return { available: true, badge, badgeColor: remaining <= 1 ? 'amber' : 'cyan', recastInfo };
    }

    // Cooldown check (non-charge skills only)
    const sharedIds = getSharedCooldownIds(m.id);

    const sameSkillUses = relevantMitigations
        .filter(am => sharedIds.includes(am.mitigationId))
        .sort((a, b) => a.time - b.time);

    if (sameSkillUses.length > 0) {
        // Forward check: is the skill still on cooldown from a previous use?
        const prevUses = sameSkillUses.filter(u => u.time <= selectedTime);
        if (prevUses.length > 0) {
            const lastPrev = prevUses[prevUses.length - 1];
            const cdEnd = lastPrev.time + m.recast;
            if (selectedTime < cdEnd) {
                const remaining = Math.ceil(cdEnd - selectedTime);
                const label = t('mitigation.cd_remaining', { seconds: remaining, defaultValue: `CD ${remaining}s` });
                // ドラッグ中はブロック維持(被りに気づくきっかけが薄いため)。
                if (ignoreInstanceId) {
                    return { available: false, message: label };
                }
                // クリック配置: 赤+禁止カーソルの見た目は available:false で維持しつつ、
                // conflictOverride でクリックだけ解放して配置できるようにする。
                // 競合の可視化(脈動/矢印)は timelineMitigations からの派生(findSameSkillCdConflicts)が担う。
                return { available: false, conflictOverride: true, message: label };
            }
        }

        // Backward check: would this placement's cooldown overlap with a future use?
        const nextUses = sameSkillUses.filter(u => u.time > selectedTime);
        if (nextUses.length > 0) {
            const firstNext = nextUses[0];
            if (selectedTime + m.recast > firstNext.time) {
                const overlap = Math.ceil((selectedTime + m.recast) - firstNext.time);
                // When dragging, we want to block if we overlap with a future CD
                if (ignoreInstanceId) {
                    const label = t('mitigation.cd_overlap', { seconds: overlap, defaultValue: `CD overlap (${overlap}s)` });
                    return { available: false, message: label };
                }

                // If just selecting, show warning
                const gap = Math.floor(firstNext.time - selectedTime);
                const label = t('mitigation.next_at', { time: firstNext.time, gap, defaultValue: `Next at ${firstNext.time}s (${gap}s gap)` });
                const shortLabel = t('mitigation.next_at_short', { gap, defaultValue: `In use ${gap}s later` });
                // Get resource badge if applicable
                const resourceBadge = m.resourceCost ? (() => {
                    let stacks = 0;
                    if (m.resourceCost!.type === 'aetherflow') stacks = getAetherflowStacks(selectedTime, relevantMitigations);
                    else if (m.resourceCost!.type === 'addersgall') stacks = getAddersgallStacks(selectedTime, relevantMitigations);
                    else if (m.resourceCost!.type === 'lily') stacks = getLilyStacks(selectedTime, relevantMitigations);
                    return { badge: `×${stacks}`, badgeColor: stacks <= 1 ? 'amber' as const : 'cyan' as const };
                })() : {};
                return { available: true, warning: true, message: label, shortMessage: shortLabel, conflictInstanceId: firstNext.id, ...resourceBadge };
            }
        }
    }

    // If we have resource cost, return with badge (passed the resource check earlier)
    if (m.resourceCost) {
        let stacks = 0;
        if (m.resourceCost.type === 'aetherflow') stacks = getAetherflowStacks(selectedTime, relevantMitigations);
        else if (m.resourceCost.type === 'addersgall') stacks = getAddersgallStacks(selectedTime, relevantMitigations);
        else if (m.resourceCost.type === 'lily') stacks = getLilyStacks(selectedTime, relevantMitigations);
        const badge = `×${stacks}`;
        return { available: true, badge, badgeColor: stacks <= 1 ? 'amber' : 'cyan' };
    }

    return { available: true };
}