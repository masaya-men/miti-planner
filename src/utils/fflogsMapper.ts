/**
 * src/utils/fflogsMapper.ts — V4.8
 *
 * Key fixes from V4.7:
 *  - Fix onMT misattribution: single non-tank targets now default to 'AoE'
 *  - Add same-timeSec grouping merge for abilities hitting both tanks and non-tanks
 */

import type { FFLogsRawEvent, FFLogsFight, DeathEvent } from '../api/fflogs';
import type { TimelineEvent } from '../types';
import { roundDamageCeil } from './damageRounding';

const AA_NAMES = new Set(['Attack', 'Shot', '攻撃', 'Attaque', 'Attacke']);
const GROUPING_WINDOW_MS = 800;
const AA_PROXIMITY_MS = 500;
const TB_DAMAGE_RATIO = 1.5;

function isAutoAttack(ev: FFLogsRawEvent): boolean {
    return AA_NAMES.has(ev.ability?.name?.trim() ?? '');
}

function mapDamageType(t: number | undefined): 'physical' | 'magical' | 'unavoidable' {
    if (t === undefined) return 'magical';

    // FFXIV / FFLogs Ability Types:
    // 1: Physical Slashing
    // 2: Piercing
    // 3: Blunt
    // 4: Shot (Ranged Physical)
    // 5: Magic
    // 6: Unique (Usually Magical depending on scaling)
    // Sometimes FFLogs uses 1=Physical generally, 2=Magical.
    // Also, physical damage often has IDs 1, 2, 3, 4. Magical is 2, 5, 8.

    // We will treat 1, 2, 3, 4 as physical attacks.
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
    // Use packetID + targetID as composite key.
    // AoE abilities share the same packetID across all targets,
    // so packetID alone would collapse 8 players into 1.
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

function isAA(ev: TimelineEvent): boolean { return ev.name.ja === 'AA' || ev.name.en === 'AA'; }
function isTankTgt(ev: TimelineEvent): boolean { return ev.target === 'MT' || ev.target === 'ST'; }

interface Norm {
    timeSec: number; timeMs: number; rawDmg: number; aa: boolean;
    enName: string; jpName: string; guid: number;
    aType: number | undefined; tgtID: number;
}

export interface MapperResult {
    events: TimelineEvent[];
    stats: {
        totalRawEvents: number; filteredEvents: number; timelineEventCount: number;
        aaCount: number; mechanicCount: number; mtId: number | null; stId: number | null;
    };
}

export function mapFFLogsToTimeline(
    rawEn: FFLogsRawEvent[], rawJp: FFLogsRawEvent[], fight: FFLogsFight,
    deaths: DeathEvent[] = []
): MapperResult {
    // ── DEBUG: Raw event analysis ──
    const DEBUG_NAMES = ['Fixer', 'フィクサー', 'Cellular', '細胞重爆', 'Visceral', 'ヴィセラル'];
    const isDebugAbility = (ev: FFLogsRawEvent) =>
        DEBUG_NAMES.some(n => (ev.ability?.name ?? '').includes(n));

    console.group('🔍 [Mapper Debug] Raw EN events analysis');
    console.log(`Total raw EN events: ${rawEn.length}`);
    const debugRawGroups = new Map<string, FFLogsRawEvent[]>();
    for (const ev of rawEn) {
        if (!isDebugAbility(ev)) continue;
        const key = ev.ability?.name ?? 'unknown';
        if (!debugRawGroups.has(key)) debugRawGroups.set(key, []);
        debugRawGroups.get(key)!.push(ev);
    }
    for (const [name, evts] of debugRawGroups) {
        const pids = new Set(evts.map(e => e.packetID));
        const tids = new Set(evts.map(e => e.targetID));
        const types = evts.map(e => e.type);
        const typeCounts: Record<string, number> = {};
        types.forEach(t => { typeCounts[t] = (typeCounts[t] || 0) + 1; });
        console.log(`  [${name}]`, {
            totalEvents: evts.length,
            uniquePacketIDs: pids.size,
            uniqueTargetIDs: tids.size,
            targetIDs: [...tids],
            typeCounts,
            abilityType: evts[0]?.ability?.type,
            abilityGuid: evts[0]?.ability?.guid,
            sampleEvent: evts[0] ? {
                amount: evts[0].amount,
                absorbed: evts[0].absorbed,
                mitigated: evts[0].mitigated,
                unmitigatedAmount: evts[0].unmitigatedAmount,
                multiplier: evts[0].multiplier,
                packetID: evts[0].packetID,
                tick: evts[0].tick,
            } : null
        });
    }
    console.groupEnd();

    const dd = dedupe(rawEn);

    console.group('🔍 [Mapper Debug] After dedupe');
    console.log(`Dedupe result: ${rawEn.length} → ${dd.length}`);
    for (const [name] of debugRawGroups) {
        const evts = dd.filter(e => (e.ability?.name ?? '').includes(name.slice(0, 4)));
        const tids = new Set(evts.map(e => e.targetID));
        console.log(`  [${name}] after dedupe: ${evts.length} events, ${tids.size} unique targets`, [...tids]);
    }
    console.groupEnd();

    // Keep ALL events with any damage field — even 0-damage (barrier absorbed).
    // Critical for correct target counting (AoE detection).
    const filtered = dd.filter(ev =>
        ev.tick !== true &&
        (ev.unmitigatedAmount !== undefined || ev.amount !== undefined ||
            ev.absorbed !== undefined || ev.mitigated !== undefined) &&
        getRawDamage(ev) < 999999 // Exclude unsurvivable wipe mechanics (e.g. 7M+ damage)
    );

    console.group('🔍 [Mapper Debug] After filter');
    console.log(`Filter result: ${dd.length} → ${filtered.length}`);
    for (const [name] of debugRawGroups) {
        const evts = filtered.filter(e => (e.ability?.name ?? '').includes(name.slice(0, 4)));
        const tids = new Set(evts.map(e => e.targetID));
        const rawDmgs = evts.map(e => getRawDamage(e));
        console.log(`  [${name}] after filter: ${evts.length} events, ${tids.size} unique targets`, {
            targetIDs: [...tids],
            rawDamages: rawDmgs.slice(0, 10),
        });
    }
    console.groupEnd();

    // Dead player filtering: remove events on players who were dead at the time.
    const deathMap = new Map<number, number[]>();
    for (const d of deaths) {
        if (!deathMap.has(d.targetID)) deathMap.set(d.targetID, []);
        deathMap.get(d.targetID)!.push(d.timestamp);
    }
    for (const ts of deathMap.values()) ts.sort((a, b) => a - b);

    // A player is "dead" for 15s after the death event (raise + weakness window).
    const DEATH_WINDOW_MS = 15000;
    const isTargetDead = (targetID: number, timestamp: number): boolean => {
        const deathTs = deathMap.get(targetID);
        if (!deathTs) return false;
        return deathTs.some(dt => timestamp > dt && timestamp - dt < DEATH_WINDOW_MS);
    };

    const alive = filtered.filter(ev =>
        !isTargetDead(ev.targetID ?? -1, ev.timestamp)
    );

    if (deaths.length > 0) {
        console.group('🔍 [Mapper Debug] Death filtering');
        console.log(`Deaths found: ${deaths.length}`, deaths);
        console.log(`Events before: ${filtered.length}, after: ${alive.length}, removed: ${filtered.length - alive.length}`);
        console.groupEnd();
    }

    if (!alive.length) {
        return {
            events: [], stats: {
                totalRawEvents: rawEn.length, filteredEvents: 0,
                timelineEventCount: 0, aaCount: 0, mechanicCount: 0, mtId: null, stId: null
            }
        };
    }

    // JP names
    const jpMap = new Map<number, string>();
    for (const ev of rawJp) {
        const g = ev.ability?.guid ?? ev.abilityGameID;
        const n = ev.ability?.name?.trim();
        if (g !== undefined && n && !jpMap.has(g)) jpMap.set(g, n);
    }

    // Normalize
    const ref = fight.startTime;
    const norm: Norm[] = alive.filter(ev => ev.timestamp >= ref).map(ev => {
        const ms = ev.timestamp - ref;
        const a = isAutoAttack(ev);
        const g = ev.ability?.guid ?? ev.abilityGameID ?? -1;
        const jp = jpMap.get(g);
        const en = a ? 'AA' : (ev.ability?.name?.trim() || 'Unknown');
        const jpN = jp ? (AA_NAMES.has(jp) ? 'AA' : jp) : en;
        return {
            timeSec: Math.floor(ms / 1000), timeMs: ms, rawDmg: getRawDamage(ev),
            aa: a, enName: en, jpName: jpN, guid: g,
            aType: ev.ability?.type, tgtID: ev.targetID ?? -1
        };
    });

    // MT/ST identification（時系列追跡でタンクスイッチ検出）
    const hits = new Map<number, { c: number; f: number }>();
    for (const n of norm) {
        if (!n.aa) continue;
        const e = hits.get(n.tgtID); if (!e) hits.set(n.tgtID, { c: 1, f: n.timeMs }); else e.c++;
    }
    const sorted = [...hits.entries()].sort((a, b) => b[1].c - a[1].c || a[1].f - b[1].f);
    const tankA = sorted[0]?.[0] ?? null; // 初期MT（AA被弾最多）
    const tankB = sorted[1]?.[0] ?? null;
    const mtId = tankA; // 後方互換（非AA技のtarget判定に使用）
    const stId = tankB;
    const tanks = new Set<number>();
    if (tankA !== null) tanks.add(tankA);
    if (tankB !== null) tanks.add(tankB);

    // AAイベントを時系列で追跡し、AA対象の切り替わり（タンクスイッチ）を検出
    const aaTimeSorted = norm.filter(n => n.aa).sort((a, b) => a.timeMs - b.timeMs);
    let currentMtId = tankA;
    const mtAtTime = new Map<number, number | null>();
    for (const ev of aaTimeSorted) {
        if (ev.tgtID === tankA || ev.tgtID === tankB) {
            currentMtId = ev.tgtID;
        }
        mtAtTime.set(ev.timeSec, currentMtId);
    }
    const allAaTimeSecs = [...mtAtTime.keys()].sort((a, b) => a - b);
    function getMtIdAt(timeSec: number): number | null {
        let result = tankA;
        for (const t of allAaTimeSecs) {
            if (t > timeSec) break;
            result = mtAtTime.get(t) ?? tankA;
        }
        return result;
    }

    // AA timestamp unification (500ms proximity → first event's ms)
    const aaList = norm.filter(n => n.aa).sort((a, b) => a.timeMs - b.timeMs);
    let gs = 0;
    for (let i = 1; i <= aaList.length; i++) {
        if (i === aaList.length || aaList[i].timeMs - aaList[gs].timeMs > AA_PROXIMITY_MS) {
            const uMs = aaList[gs].timeMs;
            const uSec = Math.floor(uMs / 1000);
            for (let k = gs; k < i; k++) { aaList[k].timeMs = uMs; aaList[k].timeSec = uSec; }
            gs = i;
        }
    }

    // Pre-compute uniform base damage per ability (tank vs non-tank split)
    interface DmgInfo { mt: number; pt: number; hT: boolean; hP: boolean; }
    const admg = new Map<number, DmgInfo>();
    for (const n of norm) {
        let d = admg.get(n.guid);
        if (!d) { d = { mt: 0, pt: 0, hT: false, hP: false }; admg.set(n.guid, d); }
        if (tanks.has(n.tgtID)) { d.hT = true; if (n.rawDmg > d.mt) d.mt = n.rawDmg; }
        else { d.hP = true; if (n.rawDmg > d.pt) d.pt = n.rawDmg; }
    }

    const tbSet = new Set<number>();
    const dmgT = new Map<number, number>();
    const dmgP = new Map<number, number>();
    for (const [g, d] of admg) {
        if (d.hT && d.hP && d.mt > d.pt * TB_DAMAGE_RATIO) {
            tbSet.add(g);
            dmgT.set(g, Math.floor(d.mt / 1.05));
            dmgP.set(g, Math.floor(d.pt / 1.05));
        } else {
            const mx = Math.max(d.mt, d.pt);
            dmgT.set(g, Math.floor(mx / 1.05));
            dmgP.set(g, Math.floor(mx / 1.05));
        }
    }

    // AA base: floor(maxRaw / 1.05 * 0.8) — tank mastery
    const aaGuid = norm.find(n => n.aa)?.guid ?? -1;
    const aaInfo = admg.get(aaGuid);
    const aaMax = Math.max(aaInfo?.mt ?? 0, aaInfo?.pt ?? 0);
    const aaBD = Math.floor((aaMax / 1.05) * 0.8);

    // Non-AA: 800ms grouping
    const tl: TimelineEvent[] = [];
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

    // Post-merge Phase 1: merge same-ability, same-timeSec groups.
    // This handles attacks like リーサルスカージ where the same ability hits
    // both tanks and non-tanks at the same second but gets split into
    // separate groups due to event ordering.
    for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
            if (groups[i][0].guid !== groups[j][0].guid) continue;
            if (groups[i][0].timeSec !== groups[j][0].timeSec) continue;
            // Same ability, same second → merge
            groups[i].push(...groups[j]);
            groups.splice(j, 1);
            j--;
        }
    }

    // Post-merge Phase 2: merge same-ability groups within 2s of each other,
    // but ONLY when the smaller group has ≤2 events (likely a split outlier,
    // not a separate cast). This prevents merging legitimate 1s-interval casts.
    const MERGE_WINDOW_MS = 2000;
    for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
            if (groups[i][0].guid !== groups[j][0].guid) continue;
            const smaller = Math.min(groups[i].length, groups[j].length);
            if (smaller > 2) continue;  // Both groups are large → separate casts
            const lastMs_i = Math.max(...groups[i].map(n => n.timeMs));
            const firstMs_j = Math.min(...groups[j].map(n => n.timeMs));
            if (firstMs_j - lastMs_i <= MERGE_WINDOW_MS) {
                // Merge j into i; use the larger group's timeSec
                const biggerSec = groups[i].length >= groups[j].length
                    ? groups[i][0].timeSec : groups[j][0].timeSec;
                groups[i].push(...groups[j]);
                for (const n of groups[i]) n.timeSec = biggerSec;
                groups.splice(j, 1);
                j--; // re-check from same position
            }
        }
    }

    // DEBUG: grouping results
    console.group('🔍 [Mapper Debug] 800ms Grouping Results');
    for (const gr of groups) {
        const n0 = gr[0];
        if (!DEBUG_NAMES.some(d => n0.jpName.includes(d) || n0.enName.includes(d))) continue;
        const uTgts = new Set(gr.map(n => n.tgtID));
        console.log(`  [${n0.jpName} / ${n0.enName}] guid=${n0.guid} timeSec=${n0.timeSec}`, {
            eventsInGroup: gr.length,
            uniqueTargets: uTgts.size,
            targetIDs: [...uTgts],
            isTB: tbSet.has(n0.guid),
            abilityType: n0.aType,
            timeMs: gr.map(n => n.timeMs),
        });
    }
    console.groupEnd();

    // Process groups
    for (const gr of groups) {
        const f = gr[0], g = f.guid, tb = tbSet.has(g);
        const uTgts = new Set(gr.map(n => n.tgtID));
        const tHits = gr.filter(n => tanks.has(n.tgtID));
        const pHits = gr.filter(n => !tanks.has(n.tgtID));

        if (tb && tHits.length > 0 && pHits.length > 0) {
            // Composite: TB at timeSec, AoE at timeSec+1
            const td = dmgT.get(g) ?? 0;
            for (const tid of new Set(tHits.map(n => n.tgtID))) {
                tl.push({
                    id: genId(), time: f.timeSec, name: { ja: `${f.jpName} (TB)`, en: `${f.enName} (TB)` },
                    damageType: mapDamageType(f.aType),
                    damageAmount: td > 0 ? td : undefined, target: tid === stId ? 'ST' : 'MT'
                });
            }
            const pd = dmgP.get(g) ?? 0;
            tl.push({
                id: genId(), time: f.timeSec + 1, name: { ja: f.jpName, en: f.enName },
                damageType: mapDamageType(f.aType), damageAmount: pd > 0 ? pd : undefined, target: 'AoE'
            });

        } else if (tb && tHits.length > 0) {
            // Tank-only TB
            const td = dmgT.get(g) ?? 0;
            for (const tid of new Set(tHits.map(n => n.tgtID))) {
                tl.push({
                    id: genId(), time: f.timeSec, name: { ja: `${f.jpName} (TB)`, en: `${f.enName} (TB)` },
                    damageType: mapDamageType(f.aType),
                    damageAmount: td > 0 ? td : undefined, target: tid === stId ? 'ST' : 'MT'
                });
            }

        } else if (tb && pHits.length > 0) {
            // Party-only for TB ability
            const pd = dmgP.get(g) ?? 0;
            tl.push({
                id: genId(), time: f.timeSec, name: { ja: f.jpName, en: f.enName },
                damageType: mapDamageType(f.aType), damageAmount: pd > 0 ? pd : undefined,
                target: uTgts.size >= 3 ? 'AoE' : 'MT'
            });

        } else if (uTgts.size >= 3) {
            // AoE (3+ unique targets = ALWAYS AoE, regardless of who was hit)
            const d = dmgP.get(g) ?? 0;
            tl.push({
                id: genId(), time: f.timeSec, name: { ja: f.jpName, en: f.enName },
                damageType: mapDamageType(f.aType), damageAmount: d > 0 ? d : undefined, target: 'AoE'
            });

        } else if (uTgts.size === 2 && [...uTgts].every(id => tanks.has(id))) {
            // Both tanks
            const d = dmgP.get(g) ?? 0;
            for (const tid of uTgts) {
                tl.push({
                    id: genId(), time: f.timeSec, name: { ja: f.jpName, en: f.enName },
                    damageType: mapDamageType(f.aType), damageAmount: d > 0 ? d : undefined,
                    target: tid === stId ? 'ST' : 'MT'
                });
            }

        } else if (uTgts.size === 2) {
            const d = dmgP.get(g) ?? 0;
            tl.push({
                id: genId(), time: f.timeSec, name: { ja: f.jpName, en: f.enName },
                damageType: mapDamageType(f.aType), damageAmount: d > 0 ? d : undefined, target: 'AoE'
            });

        } else {
            // Single target hit
            const [tid] = uTgts;
            const d = dmgP.get(g) ?? 0;
            // If target is not a tank, treat as AoE (party-wide attack that hit 1 target)
            const target = tid === stId ? 'ST' : (tid === mtId ? 'MT' : 'AoE');
            tl.push({
                id: genId(), time: f.timeSec, name: { ja: f.jpName, en: f.enName },
                damageType: mapDamageType(f.aType), damageAmount: d > 0 ? d : undefined,
                target
            });
        }
    }

    // AA events（全件出力。タンクスイッチを時系列追跡で反映）
    // 同時に両タンクにAAが来るボス（M4S前半等）にも対応
    const aaGr = new Map<string, Norm[]>();
    for (const n of norm) {
        if (!n.aa) continue;
        const k = `${n.timeSec}:${n.tgtID}`;
        if (!aaGr.has(k)) aaGr.set(k, []);
        aaGr.get(k)!.push(n);
    }

    let aaC = 0;
    for (const [k, gr] of aaGr) {
        const [s, t] = k.split(':');
        const sec = parseInt(s, 10), tid = parseInt(t, 10);
        const curMt = getMtIdAt(sec);
        const target = tid === curMt ? 'MT' : 'ST';
        tl.push({
            id: genId(), time: sec, name: { ja: gr[0].jpName, en: gr[0].enName },
            damageType: mapDamageType(gr[0].aType), damageAmount: aaBD > 0 ? aaBD : undefined,
            target
        });
        aaC++;
    }

    // Sort
    const tOrd: Record<string, number> = { 'AoE': 0, 'MT': 1, 'ST': 2 };
    const doSort = () => tl.sort((a, b) =>
        a.time !== b.time ? a.time - b.time : (tOrd[a.target ?? 'AoE'] ?? 0) - (tOrd[b.target ?? 'AoE'] ?? 0));
    doSort();

    // Cross-skill shift rules:
    // Rule A: non-AA tank-target + AoE at same time → AoE to +1s
    // Rule B: AoE (non-AA) + AA at same time → AA to +1s
    let ch = true;
    while (ch) {
        ch = false;
        const bt = new Map<number, number[]>();
        for (let i = 0; i < tl.length; i++) {
            const t = tl[i].time;
            if (!bt.has(t)) bt.set(t, []); bt.get(t)!.push(i);
        }
        for (const [, ix] of bt) {
            if (ix.length < 2) continue;
            const hasNonAATank = ix.some(i => isTankTgt(tl[i]) && !isAA(tl[i]));
            const hasAoE = ix.some(i => tl[i].target === 'AoE' && !isAA(tl[i]));
            const hasAA = ix.some(i => isAA(tl[i]));
            // Rule A: TB + AoE → push AoE to +1s
            if (hasNonAATank && hasAoE) {
                for (const i of ix) { if (tl[i].target === 'AoE') { tl[i].time += 1; ch = true; } }
            }
            // Rule B: AoE + AA → push AA to +1s
            if (hasAoE && hasAA) {
                for (const i of ix) { if (isAA(tl[i])) { tl[i].time += 1; ch = true; } }
            }
        }
        if (ch) doSort();
    }

    // Overflow guard: max 2 events per timeSec
    ch = true;
    while (ch) {
        ch = false;
        const bt = new Map<number, number[]>();
        for (let i = 0; i < tl.length; i++) {
            const t = tl[i].time;
            if (!bt.has(t)) bt.set(t, []); bt.get(t)!.push(i);
        }
        for (const [, ix] of bt) {
            if (ix.length <= 2) continue;
            const s = [...ix].sort((a, b) => {
                const aA = isAA(tl[a]), bA = isAA(tl[b]);
                if (aA !== bA) return aA ? 1 : -1; return a - b;
            });
            for (let k = 2; k < s.length; k++) { tl[s[k]].time += 1; ch = true; }
        }
        if (ch) doSort();
    }

    // Apply adaptive ceiling rounding to all damage values (3 significant digits, always rounds up)
    for (const ev of tl) {
        if (ev.damageAmount !== undefined && ev.damageAmount > 0) {
            ev.damageAmount = roundDamageCeil(ev.damageAmount);
        }
    }

    return {
        events: tl, stats: {
            totalRawEvents: rawEn.length, filteredEvents: alive.length,
            timelineEventCount: tl.length, aaCount: aaC, mechanicCount: tl.length - aaC, mtId, stId
        }
    };
}
