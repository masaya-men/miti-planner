/**
 * src/utils/fflogsMapper.ts — V6.0
 *
 * Damage-first hybrid: ダメージイベントを起点にグループ化し、
 * V5.0のplayerDetails精度・ダメージ算出ロジックを組み合わせた方式。
 *
 * Key changes from V5.0:
 *  - ダメージ起点に回帰（V4.8方式の800msグループ化 + 2秒マージ）
 *  - ダメージなしキャストは「そのGUIDにダメージが1件もない場合」のみ追加
 *  - playerDetails API / AoEタンク除外 / max×1.05 等のV5.0改善は維持
 */

import type { FFLogsRawEvent, FFLogsFight, DeathEvent, PlayerDetails } from '../api/fflogsTypes';
import type { TimelineEvent, LocalizedString, Label } from '../types';
import { roundDamageCeil } from './damageRounding';
import { migrateLabels } from './labelMigration';
import { ensurePhaseEndTimes } from './phaseMigration';
import { AA_NAMES, GROUPING_WINDOW_MS, MERGE_WINDOW_MS, isAutoAttackName, mapDamageType, getRawDamage, genId, dedupe } from './fflogsMapperBasics';
import type { Norm } from './fflogsMapperTypes';
import { computeTBDamage, computeAoEDamage, unifyDamageForSameAbility } from './fflogsMapperDamage';
import { detectEnglishOnly, buildName, generateAAEvents, addNonDamageCasts } from './fflogsMapperCasts';
import { buildPhases } from './fflogsMapperPhases';

export interface MapperResult {
    events: TimelineEvent[];
    phases: { id: number; startTimeSec: number; name: LocalizedString }[];
    labels: Label[];
    stats: {
        totalRawEvents: number;
        filteredEvents: number;
        timelineEventCount: number;
        aaCount: number;
        mechanicCount: number;
        mtId: number | null;
        stId: number | null;
        isEnglishOnly: boolean;
    };
}

// ─────────────────────────────────────────────
// メインマッパー
// ─────────────────────────────────────────────

export function mapFFLogsToTimeline(
    rawEn: FFLogsRawEvent[],
    rawJp: FFLogsRawEvent[],
    fight: FFLogsFight,
    deaths: DeathEvent[],
    castEn: FFLogsRawEvent[],
    castJp: FFLogsRawEvent[],
    players: PlayerDetails,
): MapperResult {
    const ref = fight.startTime;

    // ── プレイヤー情報セットアップ（V5.0） ──
    const tankIds = new Set(players.tanks.map(p => p.id));

    // ── 言語検出（V5.0） ──
    const isEnglishOnly = detectEnglishOnly(castEn, castJp);

    // ── JP名マップ構築 ──
    const jpNameMap = new Map<number, string>();
    for (const ev of [...rawJp, ...castJp]) {
        const g = ev.ability?.guid ?? ev.abilityGameID;
        const n = ev.ability?.name?.trim();
        if (g !== undefined && n && !jpNameMap.has(g)) jpNameMap.set(g, n);
    }

    // ── EN名マップ構築 ──
    const enNameMap = new Map<number, string>();
    for (const ev of [...rawEn, ...castEn]) {
        const g = ev.ability?.guid ?? ev.abilityGameID;
        const n = ev.ability?.name?.trim();
        if (g !== undefined && n && !enNameMap.has(g)) enNameMap.set(g, n);
    }

    // ── デス状態フィルタ準備 ──
    const deathMap = new Map<number, number[]>();
    for (const d of deaths) {
        if (!deathMap.has(d.targetID)) deathMap.set(d.targetID, []);
        deathMap.get(d.targetID)!.push(d.timestamp);
    }
    for (const ts of deathMap.values()) ts.sort((a, b) => a - b);
    const DEATH_WINDOW_MS = 15000;
    const isTargetDead = (targetID: number, timestamp: number): boolean => {
        const deathTs = deathMap.get(targetID);
        if (!deathTs) return false;
        return deathTs.some(dt => timestamp > dt && timestamp - dt < DEATH_WINDOW_MS);
    };

    // ── ダメージイベント前処理 ──
    const dd = dedupe(rawEn);
    const filtered = dd.filter(ev =>
        ev.tick !== true &&
        ev.timestamp >= ref &&
        (ev.unmitigatedAmount !== undefined || ev.amount !== undefined ||
            ev.absorbed !== undefined || ev.mitigated !== undefined) &&
        getRawDamage(ev) < 999999 &&
        !isTargetDead(ev.targetID ?? -1, ev.timestamp)
    );

    if (!filtered.length) {
        const tl: TimelineEvent[] = [];
        const damageGuids = new Set<number>();
        addNonDamageCasts(tl, castEn, castJp, jpNameMap, enNameMap, damageGuids, ref, isEnglishOnly);
        tl.sort((a, b) => a.time - b.time);
        const phases = buildPhases(fight);
        const tlMaxEventTime = tl.length > 0
            ? tl.reduce((max, e) => Math.max(max, e.time), 0)
            : undefined;
        const phasesForLabels = ensurePhaseEndTimes(phases.map(p => ({ id: `phase_${p.id}`, name: p.name, startTime: p.startTimeSec })), tlMaxEventTime);
        const labels = migrateLabels(tl, phasesForLabels);
        return {
            events: tl, phases, labels,
            stats: {
                totalRawEvents: rawEn.length, filteredEvents: 0,
                timelineEventCount: tl.length, aaCount: 0, mechanicCount: tl.length,
                mtId: null, stId: null, isEnglishOnly,
            },
        };
    }

    // ── Step 1: ダメージイベントを正規化（V4.8方式） ──
    const norm: Norm[] = filtered.map(ev => {
        const ms = ev.timestamp - ref;
        const g = ev.ability?.guid ?? ev.abilityGameID ?? -1;
        const enRaw = ev.ability?.name?.trim() || 'Unknown';
        const aa = isAutoAttackName(enRaw);
        const jp = jpNameMap.get(g);
        const enName = aa ? 'AA' : enRaw;
        const jpName = jp ? (AA_NAMES.has(jp) ? 'AA' : jp) : enName;
        return {
            timeSec: Math.floor(ms / 1000), timeMs: ms,
            rawDmg: getRawDamage(ev), aa, enName, jpName, guid: g,
            aType: ev.ability?.type, tgtID: ev.targetID ?? -1,
            multiplier: ev.multiplier ?? 1,
        };
    });

    // ── Step 2: MT/ST判定（V5.0: playerDetails活用） ──
    const aaHits = new Map<number, number>();
    for (const n of norm) {
        if (!n.aa || !tankIds.has(n.tgtID)) continue;
        aaHits.set(n.tgtID, (aaHits.get(n.tgtID) ?? 0) + 1);
    }
    const sorted = [...aaHits.entries()].sort((a, b) => b[1] - a[1]);
    const mtId = sorted[0]?.[0] ?? null;
    const stId = sorted[1]?.[0] ?? null;

    // ── Step 3: 非AAダメージの800msグループ化（V4.8方式） ──
    const nonAA = norm.filter(n => !n.aa).sort((a, b) => a.timeMs - b.timeMs);
    const used = new Set<number>();
    const groups: Norm[][] = [];
    for (let i = 0; i < nonAA.length; i++) {
        if (used.has(i)) continue;
        const gr: Norm[] = [nonAA[i]]; used.add(i);
        for (let j = i + 1; j < nonAA.length; j++) {
            if (used.has(j) || nonAA[j].guid !== nonAA[i].guid) continue;
            if (nonAA[j].timeMs - nonAA[i].timeMs > GROUPING_WINDOW_MS) break;
            gr.push(nonAA[j]); used.add(j);
        }
        groups.push(gr);
    }

    // Post-merge Phase 1: 同技・同秒グループをマージ（V4.8）
    for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
            if (groups[i][0].guid !== groups[j][0].guid) continue;
            if (groups[i][0].timeSec !== groups[j][0].timeSec) continue;
            groups[i].push(...groups[j]);
            groups.splice(j, 1);
            j--;
        }
    }

    // Post-merge Phase 2: 2秒以内の小グループをマージ（V4.8）
    for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
            if (groups[i][0].guid !== groups[j][0].guid) continue;
            const smaller = Math.min(groups[i].length, groups[j].length);
            if (smaller > 2) continue;
            const lastMs_i = Math.max(...groups[i].map(n => n.timeMs));
            const firstMs_j = Math.min(...groups[j].map(n => n.timeMs));
            if (firstMs_j - lastMs_i <= MERGE_WINDOW_MS) {
                const biggerSec = groups[i].length >= groups[j].length
                    ? groups[i][0].timeSec : groups[j][0].timeSec;
                groups[i].push(...groups[j]);
                for (const n of groups[i]) n.timeSec = biggerSec;
                groups.splice(j, 1);
                j--;
            }
        }
    }

    // ── Step 3.5: GUID単位のTB事前判定（V4.8方式: ダメージ比率ベース） ──
    // タンクにもパーティにも当たる技で、タンクダメージが1.5倍以上 → 複合TB
    const TB_DAMAGE_RATIO = 1.5;
    const guidDmgInfo = new Map<number, { maxTank: number; maxParty: number; hasTank: boolean; hasParty: boolean }>();
    for (const n of nonAA) {
        let d = guidDmgInfo.get(n.guid);
        if (!d) { d = { maxTank: 0, maxParty: 0, hasTank: false, hasParty: false }; guidDmgInfo.set(n.guid, d); }
        if (tankIds.has(n.tgtID)) { d.hasTank = true; if (n.rawDmg > d.maxTank) d.maxTank = n.rawDmg; }
        else { d.hasParty = true; if (n.rawDmg > d.maxParty) d.maxParty = n.rawDmg; }
    }
    const compositeTBGuids = new Set<number>();
    for (const [g, d] of guidDmgInfo) {
        if (d.hasTank && d.hasParty && d.maxTank > d.maxParty * TB_DAMAGE_RATIO) {
            compositeTBGuids.add(g);
        }
    }

    // ── Step 4: グループからTimelineEvent生成 ──
    const tl: TimelineEvent[] = [];

    for (const gr of groups) {
        const f = gr[0];
        const uTgts = new Set(gr.map(n => n.tgtID));
        const tHits = gr.filter(n => tankIds.has(n.tgtID));
        const pHits = gr.filter(n => !tankIds.has(n.tgtID));
        const isComposite = compositeTBGuids.has(f.guid);

        if (isComposite && tHits.length > 0 && pHits.length > 0) {
            // 複合: タンクには大ダメージ(TB) + パーティには全体ダメージ(AoE)
            // 例: リーサルスカージ — タンクに強打 + 全員にもダメージ
            const tankDmg = computeTBDamage(tHits);
            for (const tid of new Set(tHits.map(n => n.tgtID))) {
                tl.push({
                    id: genId(), time: f.timeSec,
                    name: buildName(f, isEnglishOnly, ' (TB)'),
                    damageType: mapDamageType(f.aType),
                    damageAmount: tankDmg > 0 ? roundDamageCeil(tankDmg) : undefined,
                    target: tid === stId ? 'ST' : 'MT',
                    guid: f.guid,
                });
            }
            const aoeDmg = computeAoEDamage(pHits);
            tl.push({
                id: genId(), time: f.timeSec + 1,
                name: buildName(f, isEnglishOnly),
                damageType: mapDamageType(f.aType),
                damageAmount: aoeDmg > 0 ? roundDamageCeil(aoeDmg) : undefined,
                target: 'AoE',
                guid: f.guid,
            });

        } else if (isComposite && tHits.length > 0) {
            // 複合技だがこのグループにはタンクのみ被弾
            const tankDmg = computeTBDamage(tHits);
            for (const tid of new Set(tHits.map(n => n.tgtID))) {
                tl.push({
                    id: genId(), time: f.timeSec,
                    name: buildName(f, isEnglishOnly, ' (TB)'),
                    damageType: mapDamageType(f.aType),
                    damageAmount: tankDmg > 0 ? roundDamageCeil(tankDmg) : undefined,
                    target: tid === stId ? 'ST' : 'MT',
                    guid: f.guid,
                });
            }

        } else if (isComposite && pHits.length > 0) {
            // 複合技だがこのグループにはパーティのみ被弾
            const aoeDmg = computeAoEDamage(pHits);
            tl.push({
                id: genId(), time: f.timeSec,
                name: buildName(f, isEnglishOnly),
                damageType: mapDamageType(f.aType),
                damageAmount: aoeDmg > 0 ? roundDamageCeil(aoeDmg) : undefined,
                target: uTgts.size >= 3 ? 'AoE' : 'MT',
                guid: f.guid,
            });

        } else if (uTgts.size >= 3) {
            // AoE（3人以上にヒット）
            const dmg = computeAoEDamage(pHits.length > 0 ? pHits : gr);
            tl.push({
                id: genId(), time: f.timeSec,
                name: buildName(f, isEnglishOnly),
                damageType: mapDamageType(f.aType),
                damageAmount: dmg > 0 ? roundDamageCeil(dmg) : undefined,
                target: 'AoE',
                guid: f.guid,
            });

        } else if (uTgts.size === 2 && [...uTgts].every(id => tankIds.has(id))) {
            // 両タンクのみ被弾 → 各タンクにTB行
            const dmg = computeTBDamage(gr);
            for (const tid of uTgts) {
                tl.push({
                    id: genId(), time: f.timeSec,
                    name: buildName(f, isEnglishOnly, ' (TB)'),
                    damageType: mapDamageType(f.aType),
                    damageAmount: dmg > 0 ? roundDamageCeil(dmg) : undefined,
                    target: tid === stId ? 'ST' : 'MT',
                    guid: f.guid,
                });
            }

        } else if (uTgts.size <= 2 && tHits.length > 0 && pHits.length === 0) {
            // タンク1人のみ被弾 → TB
            const dmg = computeTBDamage(tHits);
            const [tid] = uTgts;
            tl.push({
                id: genId(), time: f.timeSec,
                name: buildName(f, isEnglishOnly, ' (TB)'),
                damageType: mapDamageType(f.aType),
                damageAmount: dmg > 0 ? roundDamageCeil(dmg) : undefined,
                target: tid === stId ? 'ST' : 'MT',
                guid: f.guid,
            });

        } else if (uTgts.size === 1) {
            // 非タンク1人のみ → AoE扱い（ランタゲ等）
            const dmg = computeAoEDamage(gr);
            tl.push({
                id: genId(), time: f.timeSec,
                name: buildName(f, isEnglishOnly),
                damageType: mapDamageType(f.aType),
                damageAmount: dmg > 0 ? roundDamageCeil(dmg) : undefined,
                target: 'AoE',
                guid: f.guid,
            });

        } else {
            // 2人（タンク以外含む）→ AoE扱い
            const dmg = computeAoEDamage(pHits.length > 0 ? pHits : gr);
            tl.push({
                id: genId(), time: f.timeSec,
                name: buildName(f, isEnglishOnly),
                damageType: mapDamageType(f.aType),
                damageAmount: dmg > 0 ? roundDamageCeil(dmg) : undefined,
                target: 'AoE',
                guid: f.guid,
            });
        }
    }

    // ── Step 5: AA処理（V5.0方式） ──
    const aaCount = generateAAEvents(tl, norm.filter(n => n.aa), tankIds, stId);

    // ── Step 5.5: 同名技のダメージ統一（V5.0） ──
    unifyDamageForSameAbility(tl);

    // ── Step 6: ダメージなしキャストの選択的追加（V6.0新ルール） ──
    // ダメージイベントに存在するGUIDは除外（キラーボイス問題の解消）
    const damageGuids = new Set(norm.map(n => n.guid));
    addNonDamageCasts(tl, castEn, castJp, jpNameMap, enNameMap, damageGuids, ref, isEnglishOnly);

    // ── Step 7: ソート ──
    tl.sort((a, b) => a.time - b.time);

    // ── Step 9: フェーズ自動生成（V5.0） ──
    const phases = buildPhases(fight);

    // ── Step 10: ラベル生成（mechanicGroupからLabel[]を生成） ──
    const tlMaxEventTime = tl.length > 0
        ? tl.reduce((max, e) => Math.max(max, e.time), 0)
        : undefined;
    const phasesForLabels = ensurePhaseEndTimes(phases.map(p => ({
        id: `phase_${p.id}`,
        name: p.name,
        startTime: p.startTimeSec,
    })), tlMaxEventTime);
    const labels = migrateLabels(tl, phasesForLabels);

    return {
        events: tl,
        phases,
        labels,
        stats: {
            totalRawEvents: rawEn.length,
            filteredEvents: filtered.length,
            timelineEventCount: tl.length,
            aaCount,
            mechanicCount: tl.length - aaCount,
            mtId, stId, isEnglishOnly,
        },
    };
}
