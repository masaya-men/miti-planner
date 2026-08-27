import type { AppliedMitigation, Mitigation, PartyMember, TimelineEvent } from '../types';
import { calculateLinkedShieldValue, CRIT_MULTIPLIER } from './calculator';
import { isPotencyBasedShield, isRecitationCritEligible } from './scholarShieldRules';
import { shieldCoverageContext, type ContextShieldEntry } from './barrierStacking';

export interface BuildContextShieldEntriesParams {
    /** この被弾時刻でアクティブな軽減インスタンス。 */
    activeMitigations: readonly AppliedMitigation[];
    /** タイムライン上の全軽減インスタンス(詠唱時バフ・リンク先の探索に使う)。 */
    timelineMitigations: readonly AppliedMitigation[];
    partyMembers: readonly PartyMember[];
    /** スキル定義一覧(Timeline の MITIGATIONS)。 */
    mitigationDefs: readonly Mitigation[];
    /** 被弾イベント(物理/魔法の型チェックにのみ使う)。 */
    event: Pick<TimelineEvent, 'damageType'>;
    /** 表示上のダメージ対象 context ('MT' | 'ST' | 'Party')。 */
    displayContext: string;
    /** この被弾でバリア状態を更新すべき context 群。 */
    affectedContexts: readonly string[];
}

export interface BuildContextShieldEntriesResult {
    /** context → その context で吸収に参加しうるバリア entry のリスト。 */
    entriesByCtx: Map<string, ContextShieldEntry[]>;
    /** appMit.id → そのバリアが実際に覆う context。エフェクト棒の早期終了ゲートに使う。 */
    coverageCtxByAppMit: Map<string, string>;
}

/**
 * 被弾 1 発ぶんの「どの context にどのバリアが効くか」を組み立てる(純粋・テスト可能)。
 *
 * `damageMapResult` のバリア吸収ループのフェーズ1。ここでは吸収を一切行わず、
 * バリアの満タン値(`maxVal`)・重なりグループ・消費優先順位だけを確定する。
 * 実際の吸収と上書き解決は `resolveContextShields`(フェーズ2)が context ごとに行う。
 *
 * フィルタ・`maxVal` の算出パイプライン(秘策/ゾーエ/回復効果アップ/Nセクト)は
 * 旧実装から逐語で移設したもので、挙動は 1:1。
 */
export function buildContextShieldEntries(
    params: BuildContextShieldEntriesParams,
): BuildContextShieldEntriesResult {
    const {
        activeMitigations,
        timelineMitigations,
        partyMembers,
        mitigationDefs,
        event,
        displayContext,
        affectedContexts,
    } = params;

    const entriesByCtx = new Map<string, ContextShieldEntry[]>();
    const coverageCtxByAppMit = new Map<string, string>();

    const pushEntry = (ctx: string, entry: ContextShieldEntry) => {
        const list = entriesByCtx.get(ctx);
        if (list) list.push(entry);
        else entriesByCtx.set(ctx, [entry]);
    };

    activeMitigations.forEach(appMit => {
        const def = mitigationDefs.find(m => m.id === appMit.mitigationId);
        if (!def) return;

        let isConditionalShield = false;
        if (def.id === 'helios_conjunction') {
            const nsActive = timelineMitigations.some(m =>
                m.mitigationId === 'neutral_sect' &&
                m.time <= appMit.time &&
                appMit.time < m.time + m.duration
            );
            if (nsActive) isConditionalShield = true;
        }

        if (!def.isShield && !isConditionalShield) return;

        // このバリアが実際に覆う context。棒の早期終了はこのバケツが尽きたときだけ。
        const coverageCtx = shieldCoverageContext(appMit.targetId, def.scope, appMit.ownerId);
        // 未設定のバリアは最も遅く消費される扱い(既存の相対順を壊さない安全側)。
        const priority = def.barrierConsumptionPriority ?? Number.MAX_SAFE_INTEGER;

        // copiesShield: リンク先バリアのコピー処理（展開戦術）
        if (def.copiesShield) {
            if (!appMit.linkedMitigationId) return; // リンクなし → バリア0、スキップ

            const linkedMit = timelineMitigations.find(l => l.id === appMit.linkedMitigationId);
            if (!linkedMit) return; // リンク先が見つからない → スキップ

            const linkedOwner = partyMembers.find(p => p.id === linkedMit.ownerId);
            if (!linkedOwner) return;

            const shieldValue = calculateLinkedShieldValue(
                linkedMit, timelineMitigations, partyMembers, mitigationDefs
            );
            // 旧 `if (shieldRemaining > 0)` ゲートの再現。値 0 のバリアは entry にしない。
            // entry にすると非スタック解決(resolveContextShields の上書き合戦)に参加してしまい、
            // 値を見ない後勝ちルール(laterWins)で実バリアを負かしてしまうため。
            if (shieldValue <= 0) return;

            coverageCtxByAppMit.set(appMit.id, coverageCtx);
            // copiesShieldはパーティ全体にコピー（元の鼓舞対象は直接のバリアがあるので除外）
            affectedContexts.forEach(ctx => {
                if (ctx === linkedMit.targetId) return;
                pushEntry(ctx, {
                    appMitId: appMit.id,
                    group: def.barrierStackGroup,
                    priority,
                    castTime: appMit.time,
                    maxVal: shieldValue,
                    maxStacks: def.stacks,
                    reapplyOnAbsorption: def.reapplyOnAbsorption,
                });
            });
            return; // 通常のバリア計算をスキップ
        }

        if (def.scope === 'self' && appMit.ownerId !== displayContext && appMit.targetId !== displayContext) return;
        if (appMit.targetId && appMit.targetId !== displayContext) return;
        if (def.type === 'physical' && event.damageType === 'magical') return;
        if (def.type === 'magical' && event.damageType === 'physical') return;

        const member = partyMembers.find(m => m.id === appMit.ownerId);
        if (!member) return;

        let healingMultiplier = 1;
        let critMultiplier = 1;
        const buffsAtCast = timelineMitigations.filter(b =>
            b.time <= appMit.time && appMit.time < b.time + b.duration && b.id !== appMit.id
        );

        // 回復魔力(ポテンシー)から算出するバリアだけが対象。「最大HPの◯%」等の固定値バリア
        // (ブラックナイト・ディヴァインヴェール等、valueType:'hp')は回復魔力の計算式を
        // 経由しないため、確定クリティカルや回復効果アップの倍率がそもそも乗らない。
        const potencyShield = (def.isShield || isConditionalShield) && isPotencyBasedShield(def);

        // 消費型バフチェック: バリアスキルに対して最初の1回のみ適用
        if (potencyShield) {
            // 秘策 (SCH): 確定クリティカル ×1.6。公式仕様では鼓舞激励の策/意気軒高の策
            // (旧:士気高揚の策)のみが対象。マニフェステーション/アクセッション/
            // コンソレイションは対象外(isRecitationCritEligible で絞り込み済み)。
            const activeRecitation = isRecitationCritEligible(def.id)
                ? buffsAtCast.find(b => b.mitigationId === 'recitation' && b.ownerId === appMit.ownerId)
                : undefined;
            if (activeRecitation) {
                const earlierShieldConsumes = timelineMitigations.some(m =>
                    m.id !== appMit.id &&
                    m.ownerId === appMit.ownerId &&
                    m.time >= activeRecitation.time &&
                    m.time < appMit.time &&
                    isRecitationCritEligible(m.mitigationId)
                );
                if (!earlierShieldConsumes) {
                    critMultiplier = CRIT_MULTIPLIER;
                }
            }

            // ゾーエ (SGE): 次の回復魔法 ×1.5 (公式仕様上「次の回復魔法」全般が対象のため id 制限なし)
            const activeZoe = buffsAtCast.find(b =>
                b.mitigationId === 'zoe' && b.ownerId === appMit.ownerId
            );
            if (activeZoe) {
                const earlierShieldConsumesZoe = timelineMitigations.some(m =>
                    m.id !== appMit.id &&
                    m.ownerId === appMit.ownerId &&
                    m.time >= activeZoe.time &&
                    m.time < appMit.time &&
                    mitigationDefs.find(d => d.id === m.mitigationId)?.isShield
                );
                if (!earlierShieldConsumesZoe) {
                    critMultiplier *= 1.5;
                }
            }

            buffsAtCast.forEach(buff => {
                const bDef = mitigationDefs.find(d => d.id === buff.mitigationId);
                if (bDef && bDef.healingIncrease) {
                    // healingIncreaseDuration: 回復効果アップの持続時間がメイン効果と異なる場合（例: ピュシスII）
                    const hiDuration = bDef.healingIncreaseDuration ?? bDef.duration;
                    if (appMit.time >= buff.time + hiDuration) return;
                    if (bDef.scope === 'self' && buff.ownerId !== displayContext) return;
                    // Self-only healing increase (e.g. Dissipation, Neutral Sect) only applies to the caster's own heals
                    if (bDef.healingIncreaseSelfOnly && buff.ownerId !== appMit.ownerId) return;
                    // 対象指定バフ（クラーシス、生命回生法等）: バフの対象とスキルの対象が一致する場合のみ
                    if (bDef.scope === 'target' && buff.targetId !== appMit.targetId) return;
                    healingMultiplier += (bDef.healingIncrease / 100);
                }
            });
        }

        // Always use Japanese name for computedValues lookup (SKILL_DATA keys are Japanese)
        const jaName = typeof def.name === 'string' ? def.name : (def.name.ja || '');
        let maxValBase = member.computedValues[jaName] || 0;

        if ((def.id === 'helios_conjunction' || def.id === 'aspected_helios') && isConditionalShield) {
            maxValBase = member.computedValues[`${def.name.ja} (Nセクト)`] || 0;
        }

        const maxVal = Math.floor(maxValBase * critMultiplier * healingMultiplier);
        // 旧 `if (shieldRemaining > 0)` ゲートの再現。値 0 のバリア(computedValues にキーが無い等)は
        // entry にしない。entry にすると非スタック解決(resolveContextShields の上書き合戦)に参加し、
        // 値を見ない後勝ちルール(laterWins)で実バリアを負かして吸収から永久に外してしまうため。
        if (maxVal <= 0) return;

        coverageCtxByAppMit.set(appMit.id, coverageCtx);
        affectedContexts.forEach(ctx => {
            pushEntry(ctx, {
                appMitId: appMit.id,
                group: def.barrierStackGroup,
                priority,
                castTime: appMit.time,
                maxVal,
                maxStacks: def.stacks,
                reapplyOnAbsorption: def.reapplyOnAbsorption,
            });
        });
    });

    return { entriesByCtx, coverageCtxByAppMit };
}
