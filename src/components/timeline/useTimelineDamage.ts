import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMitigations } from '../../hooks/useSkillsData';
import type { TimelineEvent, AppliedMitigation, PartyMember, Phase } from '../../types';
import type { RowLabels } from './timelineRowTypes';
import { findSameSkillCdConflicts } from '../../utils/resourceTracker';
import { isMitigationBlockedByEvent } from '../../utils/damageTypeLogic';
import { buildEffectiveTargetMap } from '../../utils/effectiveTarget';
import { isLivingDeadStyle, maxHpForEffectiveTarget, resolveLivingDeadSurvival, type LivingDeadInstance } from '../../utils/livingDead';
import { resolveContextShields, type ContextShieldState } from '../../utils/barrierStacking';
import { buildContextShieldEntries } from '../../utils/contextShieldEntries';
import { reuseEqualArray } from '../../utils/stableArray';
import { reuseEqualDamages } from './stableDamageMap';

interface UseTimelineDamageArgs {
    timelineEvents: TimelineEvent[];
    timelineMitigations: AppliedMitigation[];
    partyMembers: PartyMember[];
    phases: Phase[];
    eventsByTime: Map<number, TimelineEvent[]>;
    lastPlacedMitigationId: string | null;
}

/**
 * ダメージ計算(maxTime・競合検知・damageMap・挑発マーカー・行ラベル・生存/シールド系)。
 * 参照の同一性(prevDamageMapRef / prevSwapMarkersRef)の仕組みごと Timeline 本体から移したもの。
 * effect・描画中の ref 書き込み(useMemo 内の前回値 ref を除く)は含まない。
 */
export function useTimelineDamage({
    timelineEvents, timelineMitigations, partyMembers, phases, eventsByTime, lastPlacedMitigationId,
}: UseTimelineDamageArgs) {
    const { t } = useTranslation();
    const MITIGATIONS = useMitigations();

    // 「タイムラインの最後の行」 = maxPopulatedTime + 1 (= 行追加用の空白行)。
    // ユーザー仕様: 新規イベント追加用に最終イベント/軽減の 1 秒後の空白行が表示される。
    // この空白行までは描画 (リキャスト点線含む) を許可、 それより下には伸ばさない。
    // フェーズ・ラベルの endTime は意図的に除外 (= ユーザーの感覚に直接合わせる)。
    const maxTime = useMemo(() => {
        let max = 0;
        timelineEvents.forEach(ev => { if (ev.time > max) max = ev.time; });
        timelineMitigations.forEach(m => { if (m.time > max) max = m.time; });
        return max + 1;
    }, [timelineEvents, timelineMitigations]);

    // 競合（同スキル・CDかぶり）している軽減 ID セットを timelineMitigations から常に派生算出する。
    // store の conflictingMitigationId を廃止し、この値を MitigationItem に prop 渡しする。
    const conflictingIds = useMemo(() => findSameSkillCdConflicts(timelineMitigations), [timelineMitigations]);
    // モバイル行アイコンのパルス表示用: PC の MitigationItem が行うインライン除外
    // (conflictingIds.has(id) && id !== lastPlacedMitigationId) と同じ結果を、
    // MobileTimelineRow に渡せるよう Set として1箇所で確定させる。
    const mobileConflictingIds = useMemo(() => {
        if (lastPlacedMitigationId === null || !conflictingIds.has(lastPlacedMitigationId)) return conflictingIds;
        const next = new Set(conflictingIds);
        next.delete(lastPlacedMitigationId);
        return next;
    }, [conflictingIds, lastPlacedMitigationId]);

    const damageMapResult = useMemo(() => {
        const map = new Map<string, { unmitigated: number; mitigated: number, mitigationPercent: number, shieldTotal: number, isInvincible?: boolean, mitigationStates?: Record<string, { stacks?: number }> }>();
        const sortedEvents = [...timelineEvents].sort((a, b) => a.time - b.time);
        // バリア(シールド)が肩代わり量を完全に使い切った時刻を軽減インスタンス(appMit.id)ごとに記録。
        // エフェクト棒をこの時刻で早期終了させるために使う(PC/スマホ共通)。最初に尽きた時刻を残す。
        const shieldExhaustedAt = new Map<string, number>();
        // 重ならないバリア(鼓舞系・エウクラシア系)が上書き負けした時刻を記録。
        // 負けたバリアはその context の吸収に以降参加しない。エフェクト棒の描画は Task 6。
        const barrierOverwrittenAt = new Map<string, number>();

        // context('Party' / 'MT' / 'ST') → その context のバリア状態。イベントをまたいで永続する。
        // 旧 shieldStates + stackStates(+ 上書き負けのラッチ)を 1 つにまとめたもの。
        const ctxShieldState = new Map<string, ContextShieldState>();
        const getCtxState = (context: string): ContextShieldState => {
            let state = ctxShieldState.get(context);
            if (!state) {
                state = { remaining: new Map(), stacks: new Map(), overwritten: new Set() };
                ctxShieldState.set(context, state);
            }
            return state;
        };

        // 挑発スイッチ: 実効ターゲットマップを構築
        const swapMarkers = timelineMitigations.filter(m => {
            const d = MITIGATIONS.find(def => def.id === m.mitigationId);
            return d?.isTankSwap === true;
        });
        const effTargetMap = buildEffectiveTargetMap(sortedEvents, swapMarkers, phases);

        const livingDeadTriggers = new Map<string, number>();
        const allLivingDeads: LivingDeadInstance[] = [];
        timelineMitigations.forEach(m => {
            const def = MITIGATIONS.find(d => d.id === m.mitigationId);
            if (def && isLivingDeadStyle(def)) {
                allLivingDeads.push({
                    id: m.id, time: m.time, duration: m.duration,
                    walkingDeadDuration: def.walkingDeadDuration!, ownerId: m.ownerId, targetId: m.targetId,
                });
            }
        });

        sortedEvents.forEach(event => {
            if (!event.damageAmount) {
                map.set(event.id, { unmitigated: 0, mitigated: 0, mitigationPercent: 0, shieldTotal: 0, isInvincible: false });
                return;
            }

            const target = effTargetMap.get(event.id) ?? event.target;
            const displayContext = (target === 'MT' || target === 'ST') ? target : 'Party';
            const affectedContexts = (target === 'MT' || target === 'ST') ? [target] : ['Party', 'MT', 'ST'];

            let currentDamage = event.damageAmount;
            let mitigationMultipliers = 1;
            let displayShieldTotal = 0;
            let isInvincibleForEvent = false;
            const eventMitigationStates: Record<string, { stacks?: number }> = {}; // 🚀 Store per-event mitigation states

            const activeMitigations = timelineMitigations.filter(m =>
                m.time <= event.time && event.time < m.time + m.duration
            );

            activeMitigations.forEach(appMit => {
                const def = MITIGATIONS.find(m => m.id === appMit.mitigationId);
                if (!def) return;

                // デバフ軽減不可の攻撃には、デバフ系軽減(リプライザル等)の % を適用しない
                if (isMitigationBlockedByEvent(event, def)) return;

                if (def.scope === 'self' && appMit.ownerId !== displayContext && appMit.targetId !== displayContext) return;
                if (appMit.targetId && appMit.targetId !== displayContext) return;

                if (def.isInvincible) {
                    if (isLivingDeadStyle(def)) return; // 二段階無敵: %ループでは無視し、後段で条件付き判定
                    currentDamage = 0;
                    isInvincibleForEvent = true;
                }

                if (isInvincibleForEvent) return;

                // exclusiveWith: 同グループのスキルが同時にアクティブな場合、最後に付与された方のみ軽減適用
                if (def.exclusiveWith && def.value > 0) {
                    const laterExclusive = activeMitigations.some(other => {
                        if (other.id === appMit.id) return false;
                        const otherDef = MITIGATIONS.find(m => m.id === other.mitigationId);
                        return otherDef?.exclusiveWith === def.exclusiveWith && otherDef?.value && otherDef.value > 0 && other.time > appMit.time;
                    });
                    if (laterExclusive) return;
                }

                let mitigationValue = def.value;
                if (event.damageType === 'physical' && def.valuePhysical !== undefined) {
                    mitigationValue = def.valuePhysical;
                } else if (event.damageType === 'magical' && def.valueMagical !== undefined) {
                    mitigationValue = def.valueMagical;
                } else {
                    if (def.type === 'physical' && event.damageType === 'magical') return;
                    if (def.type === 'magical' && event.damageType === 'physical') return;
                }

                let burstMultiplier = 1;
                if (def.burstValue && def.burstDuration && event.time < appMit.time + def.burstDuration) {
                    burstMultiplier = (1 - def.burstValue / 100);
                }

                const multiplier = (1 - mitigationValue / 100) * burstMultiplier;
                currentDamage *= multiplier;
                mitigationMultipliers *= multiplier;
            });

            currentDamage = Math.floor(currentDamage);

            const damageForShields = currentDamage;

            if (!isInvincibleForEvent) {
                // フェーズ1: この被弾で各 context に効くバリアの entry を組み立てる(吸収はまだしない)。
                const { entriesByCtx, coverageCtxByAppMit } = buildContextShieldEntries({
                    activeMitigations,
                    timelineMitigations,
                    partyMembers,
                    mitigationDefs: MITIGATIONS,
                    event,
                    displayContext,
                    affectedContexts,
                });

                // フェーズ2: context ごとに「重ならないバリアの勝敗 → 消費優先順位順の吸収」を解決する。
                // ダメージを持ち回るので、1 枚目が吸った残りだけが 2 枚目に渡る(二重削りが起きない)。
                affectedContexts.forEach(ctx => {
                    const entriesForCtx = entriesByCtx.get(ctx);
                    if (!entriesForCtx || entriesForCtx.length === 0) return;

                    const res = resolveContextShields(entriesForCtx, damageForShields, getCtxState(ctx));

                    // 上書き負けしたバリアの棒を止める時刻を記録する(方式a・エフェクト棒のクリップ用)。
                    // そのバリアが覆う context のバケツで負けたときだけ記録する(Ruling H と同じ理由)。
                    // 全体バリアは Party/ST バケツで負けても MT バケツではまだ生きて吸収していることがあり、
                    // ゲート無しだと「まだ効いている棒」をクリップしてしまう。
                    res.newlyOverwritten.forEach(id => {
                        if (ctx !== coverageCtxByAppMit.get(id) || barrierOverwrittenAt.has(id)) return;
                        // 負けた時刻 = 「自分の詠唱時刻」と「同 ctx の他グループ付きバリアの最も遅い詠唱時刻」の遅い方
                        // = 両方が同時に存在し始めた時刻。被弾時刻より前になる(棒がより正確に短く終わる)。
                        // 暫定: 勝った相手そのものの castTime ではなく同 ctx グループ付きバリアの最遅 castTime を使う。
                        // 鼓舞系の「大きい方が古い」ケースで棒が同じか、やや長めになるが実害小(方式a の許容範囲)。
                        const me = entriesForCtx.find(e => e.appMitId === id)!;
                        const rivalLatestCast = Math.max(
                            me.castTime,
                            ...entriesForCtx.filter(e => e.appMitId !== id && e.group != null).map(e => e.castTime),
                        );
                        barrierOverwrittenAt.set(id, rivalLatestCast);
                    });

                    // このバリアが覆う context のバケツが尽きた瞬間を記録 → エフェクト棒をその時刻で早期終了。
                    // 全体バリアは coverageCtx='Party' なので「全体攻撃で Party バケツが尽きたとき」だけ止まり、
                    // タンク単体攻撃で MT バケツが枯れても棒は継続する(他メンバー/全体分がまだ効いているため)。
                    // スタック制(ハイマ等)は貼り直されるため尽きた扱いにならず、全スタック消費後の最後の一撃でのみ記録される。
                    res.newlyExhausted.forEach(id => {
                        if (ctx === coverageCtxByAppMit.get(id) && !shieldExhaustedAt.has(id)) {
                            shieldExhaustedAt.set(id, event.time);
                        }
                    });

                    if (ctx === displayContext) {
                        displayShieldTotal += res.totalAbsorbed; // その被弾で実際に肩代わりした量
                        currentDamage = Math.max(0, currentDamage - res.totalAbsorbed);
                        res.stacksAfter.forEach((stacks, id) => {
                            eventMitigationStates[id] = { stacks };
                        });
                    }
                });
            }

            // リビングデッド(二段階無敵): 「リビデを除いた軽減後ダメ」が致死なら、窓内最初の被弾を起点に生存
            if (!isInvincibleForEvent) {
                const livingDeads = allLivingDeads.filter(ld => ld.ownerId === displayContext || ld.targetId === displayContext);
                if (livingDeads.length > 0) {
                    const maxHp = maxHpForEffectiveTarget(target, partyMembers);
                    if (resolveLivingDeadSurvival(event.time, currentDamage, maxHp, livingDeads, livingDeadTriggers)) {
                        currentDamage = 0;
                        isInvincibleForEvent = true;
                    }
                }
            }

            const finalTaken = Math.max(0, currentDamage);
            const percentMod = Math.round((1 - mitigationMultipliers) * 100);

            map.set(event.id, {
                unmitigated: event.damageAmount,
                mitigated: finalTaken,
                mitigationPercent: percentMod,
                shieldTotal: displayShieldTotal,
                isInvincible: isInvincibleForEvent,
                mitigationStates: eventMitigationStates // 🚀 Store for UI
            });
        });

        return { map, livingDeadTriggers, shieldExhaustedAt, barrierOverwrittenAt };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 軽減の効果計算は eventsByTime / 軽減配置 / パーティ / フェーズが変わった時だけ再計算する(timelineEvents・MITIGATIONS は依存に入れると走る回数が変わる)
    }, [eventsByTime, timelineMitigations, partyMembers, phases]);

    // 中身が同じ行の damages は前回と同じ参照にして、TimelineRow の memo が効くようにする(置く・消すで全行が再描画されない)
    const prevDamageMapRef = useRef<typeof damageMapResult.map | undefined>(undefined);
    const damageMap = useMemo(() => {
        const stable = reuseEqualDamages(prevDamageMapRef.current, damageMapResult.map);
        prevDamageMapRef.current = stable;
        return stable;
    }, [damageMapResult]);
    // 行へ渡す挑発マーカー(isTankSwap)。行がストアを直接購読すると全行が描き直されるため、親で 1 回だけ計算する。
    // 挑発の増減がない限り同じ参照を保つ(置く・消すで関係ない行の memo が外れないように)
    const swapMarkersRaw = useMemo(
        () => timelineMitigations.filter(m => MITIGATIONS.find(d => d.id === m.mitigationId)?.isTankSwap === true),
        [timelineMitigations, MITIGATIONS]
    );
    const prevSwapMarkersRef = useRef<readonly AppliedMitigation[] | undefined>(undefined);
    const rowSwapMarkers = useMemo(() => {
        const stable = reuseEqualArray(prevSwapMarkersRef.current, swapMarkersRaw);
        prevSwapMarkersRef.current = stable;
        return stable;
    }, [swapMarkersRaw]);
    // 行内の文言(t() を行ごとに呼ぶと全行ぶん重い)。言語が変わった時だけ作り直す
    const rowLabels = useMemo<RowLabels>(() => ({
        orConnector: t('event.or_connector'),
        endPhase: t('timeline.end_phase'),
        addLabel: t('timeline.add_label'),
        addEvent: t('timeline.add_event'),
        mitigationSelect: t('mitigation.select'),
    }), [t]);
    const livingDeadTriggers = damageMapResult.livingDeadTriggers; // Task 5 で白黒アイコン描画に使用
    const shieldExhaustedAt = damageMapResult.shieldExhaustedAt; // バリア吸収し切り時刻 → エフェクト棒の早期終了に使用
    const barrierOverwrittenAt = damageMapResult.barrierOverwrittenAt; // 上書き負け時刻 → エフェクト棒を負けた時刻でクリップ(方式a)

    return {
        maxTime, conflictingIds, mobileConflictingIds,
        damageMapResult, damageMap, rowSwapMarkers, rowLabels,
        livingDeadTriggers, shieldExhaustedAt, barrierOverwrittenAt,
    };
}
