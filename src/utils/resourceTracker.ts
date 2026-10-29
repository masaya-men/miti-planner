import type { AppliedMitigation, Mitigation } from '../types';
import { getMitigationsFromStore } from '../hooks/useSkillsData';
import { getAetherflowStacks, getAddersgallStacks, getLilyStacks, isFairyAvailable, canUseSummonSeraph } from './jobResourceStacks';
import { effectiveMaxCharges, getRemainingCharges, getTimeUntilNextCharge } from './chargeTracker';
import { canStackSameSecond, sameSecondInstances } from './sameSecondStack';

/**
 * ドラッグで「同じ軽減のCD被り」位置へドロップした時の挙動トグル。
 * - true (現行・2026-06-17): 警告つきで許可 (持続する脈動 + 画面外シェブロンで気づけるため)。クリック配置と挙動が揃う。
 * - false: 従来のブロック挙動 (ドロップを弾いて元位置へ戻す)。
 * ユーザーから不満が出たら false に戻すだけで旧挙動が完全復活する (ブロックロジックは保持済み)。
 * 注: 競合(CD被り)以外のブロック(リソース不足/チャージ切れ/前提切れ等)はこのフラグ対象外で常にブロック。
 */
const ALLOW_DRAG_INTO_CONFLICT = true;

// WAR: 原初の血気ライン(bloodwhetting/raw_intuition)と原初の猛りライン(nascent_flash/
// nascent_flash_base)は別名・別アイコンだが、ゲーム内では同一のリキャストを共有する特例
// (自動判定では検出できないため個別に列挙)。
const BLOODWHETTING_SHARED_GROUP = ['bloodwhetting', 'raw_intuition', 'nascent_flash', 'nascent_flash_base'];

/**
 * 共有リキャストの技グループを返す。
 *
 * ほとんどの技は id 単体だが、レベル帯で新しいバージョンに切り替わる技(例: ランパートは
 * Lv93以下=rampart、Lv94以上=rampart_v2)はこのデータモデルでは**別idの別エントリ**として
 * 定義されている。過去のレベルで置いた軽減(旧id)を現在のレベルで再度置こうとした時、
 * 素の id 一致だけで判定すると「同じ技のCD被り」を検出できず、赤表示/競合パルスが出ない
 * 不具合になっていた(2026-08-14ユーザー実機報告で発覚)。
 * 同一 jobId + 同一 icon = 見た目も効果も同じ技とみなし、自動的に同じCDグループにまとめる。
 */
export function getSharedCooldownIds(id: string): string[] {
    if (BLOODWHETTING_SHARED_GROUP.includes(id)) {
        return BLOODWHETTING_SHARED_GROUP;
    }
    const defs = getMitigationsFromStore();
    const def = defs.find(d => d.id === id);
    if (!def) return [id];
    return defs.filter(d => d.jobId === def.jobId && d.icon === def.icon).map(d => d.id);
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
 * Validates if a mitigation can be placed at a specific time.
 * This is the shared logic used by both the MitigationSelector (adding new)
 * and Timeline (dragging existing).
 */
export function validateMitigationPlacement(
    m: Mitigation,
    selectedTime: number,
    activeMitigations: AppliedMitigation[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- i18next の TFunction と、呼び出し側ごとに異なる t の引数形の両方を受けるため
    t: (key: string, options?: any) => string,
    // Optional parameter to ignore a specific instance ID during overlap checks (useful for drag & drop)
    ignoreInstanceId?: string
): { available: boolean; warning?: boolean; message?: string; shortMessage?: string; badge?: string; badgeColor?: string; recastInfo?: string; conflictOverride?: boolean } {

    // Filter out the instance being moved if dragging
    const relevantMitigations = ignoreInstanceId
        ? activeMitigations.filter(am => am.id !== ignoreInstanceId)
        : activeMitigations;

    // 👆 追加ここまで

    // 引っぱって動かす時: 同じ秒にある同じ技の上へは置けない(ゲームで同じ秒に 2 回は使えない・重なると見えない)。
    // 例外は 2 回分ためられて相手を選ぶ技を別の人へ(canStackSameSecond)。回数はこの下のチャージ判定が見る。
    // クリックで置く道は同じ秒の同じ技=削除 / 相手選びになるので、ここはドラッグだけ(masaya 10-29)
    if (ignoreInstanceId) {
        const same = sameSecondInstances(m.id, selectedTime, relevantMitigations);
        const movingTarget = activeMitigations.find(am => am.id === ignoreInstanceId)?.targetId;
        if (same.length > 0 && (!canStackSameSecond(m) || same.some(am => am.targetId === movingTarget))) {
            return { available: false };
        }
    }

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

    // フェイブレッシング/エーテルパクトはエオス・セレネ専用(セラフィムには実行させられない)。
    // 光の囁き/フェイイルミネーションは名称が変わるだけで実際は使えるため対象外。
    if (m.id === 'fey_blessing' || m.id === 'aetherpact') {
        const isSeraphActive = relevantMitigations.some(am =>
            am.mitigationId === 'summon_seraph' && selectedTime >= am.time && selectedTime < am.time + am.duration
        );
        if (isSeraphActive) {
            return { available: false, message: t('mitigation.requires_fairy_not_seraph', 'フェアリーが必要なため、セラフィム中は使用できません') };
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
                // ドラッグ: 競合位置へのドロップを「警告つきで許可」(持続する脈動+画面外シェブロンで気づけるため)。
                // ALLOW_DRAG_INTO_CONFLICT を false に戻すと従来のブロック挙動が復活する(ロジックは保持)。
                if (ignoreInstanceId) {
                    if (!ALLOW_DRAG_INTO_CONFLICT) return { available: false, message: label };
                    return { available: true, warning: true, message: label };
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
                // ドラッグ: 後方競合も「警告つきで許可」。ALLOW_DRAG_INTO_CONFLICT=false で従来のブロックに戻る。
                if (ignoreInstanceId) {
                    const label = t('mitigation.cd_overlap', { seconds: overlap, defaultValue: `CD overlap (${overlap}s)` });
                    if (!ALLOW_DRAG_INTO_CONFLICT) return { available: false, message: label };
                    return { available: true, warning: true, message: label };
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
                return { available: true, warning: true, message: label, shortMessage: shortLabel, ...resourceBadge };
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