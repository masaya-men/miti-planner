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

import type { FFLogsRawEvent, FFLogsFight, DeathEvent, PlayerDetails } from '../api/fflogs';
import type { TimelineEvent } from '../types';
import { roundDamageCeil } from './damageRounding';

// ─────────────────────────────────────────────
// 定数・ユーティリティ
// ─────────────────────────────────────────────

const AA_NAMES = new Set(['Attack', 'Shot', '攻撃', 'Attaque', 'Attacke']);
const AA_PROXIMITY_MS = 500;
const GROUPING_WINDOW_MS = 800;
const MERGE_WINDOW_MS = 2000;
const DAMAGE_VARIANCE_BUFFER = 1.05;

function isAutoAttackName(name: string): boolean {
    return AA_NAMES.has(name.trim());
}

function mapDamageType(t: number | undefined): 'physical' | 'magical' | 'unavoidable' {
    if (t === undefined) return 'magical';
    if (t === 1 || t === 2 || t === 3 || t === 4 || t === 128) return 'physical';
    return 'magical';
}

function getRawDamage(ev: FFLogsRawEvent): number {
    if (ev.unmitigatedAmount !== undefined && ev.unmitigatedAmount > 0) return ev.unmitigatedAmount;
    const visible = (ev.amount || 0) + (ev.absorbed || 0);
    return Math.floor(visible / Math.max(ev.multiplier || 1, 0.01));
}

function genId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'ffl_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

function dedupe(events: FFLogsRawEvent[]): FFLogsRawEvent[] {
    const m = new Map<string, FFLogsRawEvent>();
    for (const ev of events) {
        const p = ev.packetID;
        if (p === undefined) continue;
        const key = `${p}:${ev.targetID ?? 0}`;
        const ex = m.get(key);
        if (!ex || getRawDamage(ev) > getRawDamage(ex)) m.set(key, ev);
    }
    return [...m.values(), ...events.filter(e => e.packetID === undefined)];
}

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

interface Norm {
    timeSec: number;
    timeMs: number;
    rawDmg: number;
    aa: boolean;
    enName: string;
    jpName: string;
    guid: number;
    aType: number | undefined;
    tgtID: number;
    multiplier: number;
}

export interface MapperResult {
    events: TimelineEvent[];
    phases: { id: number; startTimeSec: number; name: string }[];
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
        return {
            events: [], phases: buildPhases(fight),
            stats: {
                totalRawEvents: rawEn.length, filteredEvents: 0,
                timelineEventCount: 0, aaCount: 0, mechanicCount: 0,
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
                });
            }
            const aoeDmg = computeAoEDamage(pHits);
            tl.push({
                id: genId(), time: f.timeSec + 1,
                name: buildName(f, isEnglishOnly),
                damageType: mapDamageType(f.aType),
                damageAmount: aoeDmg > 0 ? roundDamageCeil(aoeDmg) : undefined,
                target: 'AoE',
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

    // ── Step 8: スケジューリング（同秒競合解消） ──
    resolveSchedulingConflicts(tl);

    // ── Step 9: フェーズ自動生成（V5.0） ──
    const phases = buildPhases(fight);

    return {
        events: tl,
        phases,
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

// ─────────────────────────────────────────────
// ダメージ算出
// ─────────────────────────────────────────────

/** TB用: max × 1.05 */
function computeTBDamage(hits: Norm[]): number {
    if (hits.length === 0) return 0;
    const max = Math.max(...hits.map(n => n.rawDmg));
    return Math.floor(max * DAMAGE_VARIANCE_BUFFER);
}

/** AoE用: タンク除外 → multiplier多数派 → max × 1.05 */
function computeAoEDamage(hits: Norm[]): number {
    if (hits.length === 0) return 0;
    if (hits.length === 1) return Math.floor(hits[0].rawDmg * DAMAGE_VARIANCE_BUFFER);

    // multiplierの最頻値を取得（バフ/デバフ持ちを除外）
    const counts = new Map<number, number>();
    for (const h of hits) counts.set(h.multiplier, (counts.get(h.multiplier) || 0) + 1);
    let bestMult = hits[0].multiplier;
    let bestCount = 0;
    for (const [mult, count] of counts) {
        if (count > bestCount || (count === bestCount && mult > bestMult)) {
            bestMult = mult;
            bestCount = count;
        }
    }
    const normal = hits.filter(h => h.multiplier === bestMult);
    const pool = normal.length > 0 ? normal : hits;
    return Math.floor(Math.max(...pool.map(n => n.rawDmg)) * DAMAGE_VARIANCE_BUFFER);
}

// ─────────────────────────────────────────────
// 内部関数
// ─────────────────────────────────────────────

/** 英語ログ検出（V5.0） */
function detectEnglishOnly(castEn: FFLogsRawEvent[], castJp: FFLogsRawEvent[]): boolean {
    const enNames = new Map<number, string>();
    for (const ev of castEn) {
        const g = ev.ability?.guid;
        const n = ev.ability?.name?.trim();
        if (g !== undefined && n && !isAutoAttackName(n)) {
            enNames.set(g, n);
            if (enNames.size >= 5) break;
        }
    }
    let matchCount = 0, checkCount = 0;
    for (const ev of castJp) {
        const g = ev.ability?.guid;
        const n = ev.ability?.name?.trim();
        if (g !== undefined && n && enNames.has(g)) {
            checkCount++;
            if (enNames.get(g) === n) matchCount++;
            if (checkCount >= 5) break;
        }
    }
    return checkCount >= 3 && matchCount === checkCount;
}

/** イベント名を構築 */
function buildName(
    src: { jpName: string; enName: string },
    isEnglishOnly: boolean,
    suffix: string = '',
): TimelineEvent['name'] {
    const ja = isEnglishOnly ? src.enName + suffix : src.jpName + suffix;
    const en = src.enName + suffix;
    return { ja, en };
}

/** AAイベント生成（V5.0方式） */
function generateAAEvents(
    tl: TimelineEvent[],
    aaNorms: Norm[],
    tankIds: Set<number>,
    stId: number | null,
): number {
    const sorted = [...aaNorms].sort((a, b) => a.timeMs - b.timeMs);
    const groups: Norm[][] = [];
    let gs = 0;
    for (let i = 1; i <= sorted.length; i++) {
        if (i === sorted.length || sorted[i].timeMs - sorted[gs].timeMs > AA_PROXIMITY_MS) {
            groups.push(sorted.slice(gs, i));
            gs = i;
        }
    }

    let aaCount = 0;
    for (const group of groups) {
        const byTarget = new Map<number, Norm[]>();
        for (const n of group) {
            if (!tankIds.has(n.tgtID)) continue;
            if (!byTarget.has(n.tgtID)) byTarget.set(n.tgtID, []);
            byTarget.get(n.tgtID)!.push(n);
        }

        for (const [tid, entries] of byTarget) {
            const timeSec = Math.floor(entries[0].timeMs / 1000);
            const maxDmg = Math.max(...entries.map(n => n.rawDmg));
            const baseDmg = Math.floor((maxDmg / 1.05) * 0.8);
            const target: TimelineEvent['target'] = tid === stId ? 'ST' : 'MT';

            tl.push({
                id: genId(), time: timeSec,
                name: { ja: 'AA', en: 'AA' },
                damageType: 'physical',
                damageAmount: baseDmg > 0 ? roundDamageCeil(baseDmg) : undefined,
                target,
            });
            aaCount++;
        }
    }
    return aaCount;
}

/** ダメージなしキャストの選択的追加（V6.0新ルール） */
function addNonDamageCasts(
    tl: TimelineEvent[],
    castEn: FFLogsRawEvent[],
    castJp: FFLogsRawEvent[],
    jpNameMap: Map<number, string>,
    _enNameMap: Map<number, string>,
    damageGuids: Set<number>,
    ref: number,
    isEnglishOnly: boolean,
): void {
    const castJpMap = new Map<number, string>();
    for (const ev of castJp) {
        const g = ev.ability?.guid ?? ev.abilityGameID;
        const n = ev.ability?.name?.trim();
        if (g !== undefined && n && !castJpMap.has(g)) castJpMap.set(g, n);
    }

    const seen = new Set<string>();
    const castSorted = castEn
        .filter(ev => {
            const g = ev.ability?.guid ?? ev.abilityGameID ?? -1;
            const name = ev.ability?.name?.trim() ?? '';
            // ダメージGUIDに存在する技はスキップ（★V6.0のキモ）
            if (damageGuids.has(g)) return false;
            if (AA_NAMES.has(name) || !name) return false;
            if (ev.type !== 'begincast') return false;
            return true;
        })
        .sort((a, b) => a.timestamp - b.timestamp);

    for (const ev of castSorted) {
        const g = ev.ability?.guid ?? ev.abilityGameID ?? -1;
        const timeSec = Math.floor((ev.timestamp - ref) / 1000);
        const key = `${g}:${timeSec}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const enName = ev.ability?.name?.trim() ?? 'Unknown';
        const jpName = castJpMap.get(g) ?? jpNameMap.get(g) ?? enName;

        tl.push({
            id: genId(), time: timeSec,
            name: buildName(
                { jpName: isAutoAttackName(jpName) ? 'AA' : jpName, enName },
                isEnglishOnly,
            ),
            damageType: 'magical',
            target: 'AoE',
        });
    }
}

/** 同名技のダメージを統一（V5.0） */
function unifyDamageForSameAbility(tl: TimelineEvent[]): void {
    const DEVIATION_THRESHOLD = 0.20;

    const groups = new Map<string, number[]>();
    for (let i = 0; i < tl.length; i++) {
        const ev = tl[i];
        if (!ev.damageAmount || ev.name.ja === 'AA' || ev.name.en === 'AA') continue;
        const isTB = ev.target === 'MT' || ev.target === 'ST';
        const key = isTB
            ? `${ev.name.ja}::TB`
            : `${ev.name.ja}::${ev.target ?? 'AoE'}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(i);
    }

    for (const [, indices] of groups) {
        if (indices.length < 2) continue;
        const values = indices.map(i => tl[i].damageAmount!);
        const maxVal = Math.max(...values);
        const med = median(values);
        if (med === 0) continue;

        const hasTB = indices.some(i => tl[i].target === 'MT' || tl[i].target === 'ST');
        if (hasTB) {
            const unified = roundDamageCeil(maxVal);
            for (const i of indices) tl[i].damageAmount = unified;
            continue;
        }

        const allClose = values.every(v => Math.abs(v - med) / med <= DEVIATION_THRESHOLD);
        if (allClose) {
            const unified = roundDamageCeil(med);
            for (const i of indices) tl[i].damageAmount = unified;
        }
    }
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? Math.floor((s[mid - 1] + s[mid]) / 2) : s[mid];
}

/** 同秒競合を解消（V5.0） */
function resolveSchedulingConflicts(tl: TimelineEvent[]): void {
    const isAA = (ev: TimelineEvent) => ev.name.ja === 'AA' || ev.name.en === 'AA';
    const isTankTgt = (ev: TimelineEvent) => ev.target === 'MT' || ev.target === 'ST';

    let changed = true;
    while (changed) {
        changed = false;
        tl.sort((a, b) => a.time - b.time);
        const byTime = new Map<number, number[]>();
        for (let i = 0; i < tl.length; i++) {
            const t = tl[i].time;
            if (!byTime.has(t)) byTime.set(t, []);
            byTime.get(t)!.push(i);
        }
        for (const [, ix] of byTime) {
            if (ix.length < 2) continue;
            const hasNonAATank = ix.some(i => isTankTgt(tl[i]) && !isAA(tl[i]));
            const hasAoE = ix.some(i => tl[i].target === 'AoE' && !isAA(tl[i]));
            const hasAAev = ix.some(i => isAA(tl[i]));
            if (hasNonAATank && hasAoE) {
                for (const i of ix) {
                    if (tl[i].target === 'AoE' && !isAA(tl[i])) { tl[i].time += 1; changed = true; }
                }
            }
            if (hasAoE && hasAAev) {
                for (const i of ix) {
                    if (isAA(tl[i])) { tl[i].time += 1; changed = true; }
                }
            }
        }
    }

    // 最大2イベント/秒制限
    changed = true;
    while (changed) {
        changed = false;
        tl.sort((a, b) => a.time - b.time);
        const byTime = new Map<number, number[]>();
        for (let i = 0; i < tl.length; i++) {
            const t = tl[i].time;
            if (!byTime.has(t)) byTime.set(t, []);
            byTime.get(t)!.push(i);
        }
        for (const [, ix] of byTime) {
            if (ix.length <= 2) continue;
            const s = [...ix].sort((a, b) => {
                const aA = isAA(tl[a]), bA = isAA(tl[b]);
                if (aA !== bA) return aA ? 1 : -1;
                return a - b;
            });
            for (let k = 2; k < s.length; k++) { tl[s[k]].time += 1; changed = true; }
        }
    }
    tl.sort((a, b) => a.time - b.time);
}

/** フェーズ自動生成（V5.1: report.phasesからボス名取得） */
function buildPhases(fight: FFLogsFight): { id: number; startTimeSec: number; name: string }[] {
    const transitions = fight.phaseTransitions;
    const phaseNames = fight.phaseNames;

    if (!transitions || transitions.length === 0) {
        // フェーズ遷移なし — phaseNamesがあれば最初の名前を使用
        const name = phaseNames?.[0]?.name;
        return [{ id: 1, startTimeSec: 0, name: cleanPhaseName(name) || 'P1' }];
    }

    return transitions.map(pt => {
        const nameEntry = phaseNames?.find(p => p.id === pt.id);
        return {
            id: pt.id,
            startTimeSec: Math.floor((pt.startTime - fight.startTime) / 1000),
            name: cleanPhaseName(nameEntry?.name) || `P${pt.id}`,
        };
    });
}

/**
 * FFLogsフェーズ名のクリーニング
 * "P1: Fatebreaker" → "Fatebreaker"
 * "Phase One" → "Phase One" (プレフィックスなしはそのまま)
 */
function cleanPhaseName(name: string | undefined): string {
    if (!name) return '';
    // "P1: ", "P2: " 等のプレフィックスを除去
    const stripped = name.replace(/^P\d+:\s*/, '');
    return stripped;
}
