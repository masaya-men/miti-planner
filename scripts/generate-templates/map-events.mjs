import { AA_NAMES } from './config.mjs';

// ─── Step 6: Simplified mapper (Node.js version of fflogsMapper) ───
function getRawDamage(ev) {
    if (ev.unmitigatedAmount !== undefined && ev.unmitigatedAmount > 0) return ev.unmitigatedAmount;
    const visible = (ev.amount || 0) + (ev.absorbed || 0);
    return Math.floor(visible / Math.max(ev.multiplier || 1, 0.01));
}

function isAutoAttack(ev) {
    return AA_NAMES.has(ev.ability?.name?.trim() ?? '');
}

function mapDamageType(t) {
    if (t === undefined) return 'magical';
    if (t === 1 || t === 2 || t === 3 || t === 4 || t === 128) return 'physical';
    return 'magical';
}

export function mapEventsToTimeline(rawEn, rawJp, fight, xivApiDict = new Map(), deaths = [], castEn = [], castJp = []) {
    // Deduplicate
    const deduped = new Map();
    for (const ev of rawEn) {
        const p = ev.packetID;
        if (p === undefined) continue;
        const key = `${p}:${ev.targetID ?? 0}`;
        const ex = deduped.get(key);
        if (!ex || getRawDamage(ev) > getRawDamage(ex)) deduped.set(key, ev);
    }
    const dd = [...deduped.values(), ...rawEn.filter(e => e.packetID === undefined)];

    // Filter
    const filtered = dd.filter(ev =>
        ev.tick !== true &&
        (ev.unmitigatedAmount !== undefined || ev.amount !== undefined ||
         ev.absorbed !== undefined || ev.mitigated !== undefined) &&
        getRawDamage(ev) < 999999
    );

    if (!filtered.length) return [];

    // デス後のダメージ除外（戦闘不能後15秒間のイベントを除外）
    const DEATH_WINDOW_MS = 15000;
    const deathMap = new Map();
    for (const d of deaths) {
        if (!deathMap.has(d.targetID)) deathMap.set(d.targetID, []);
        deathMap.get(d.targetID).push(d.timestamp);
    }
    for (const ts of deathMap.values()) ts.sort((a, b) => a - b);

    const alive = filtered.filter(ev => {
        const deathTs = deathMap.get(ev.targetID);
        if (!deathTs) return true;
        return !deathTs.some(dt => ev.timestamp > dt && ev.timestamp - dt < DEATH_WINDOW_MS);
    });

    if (deaths.length > 0) {
        const removed = filtered.length - alive.length;
        if (removed > 0) console.log(`   🪦 Death filter: removed ${removed} events on dead players`);
    }

    // _rsv_ で始まる名前は未公開スキルの内部予約名なので無効とみなす
    const isValidName = (name) => name && !name.startsWith('_rsv_');

    // 不明なスキル名を GUID ごとに一貫した番号で命名（同じ技 = 同じ名前）
    const unknownCounter = new Map();
    let unknownIdx = 0;
    const getUnknownName = (guid) => {
        if (unknownCounter.has(guid)) return unknownCounter.get(guid);
        unknownIdx++;
        const padded = String(unknownIdx).padStart(2, '0');
        const name = `Unknown_${padded}`;
        unknownCounter.set(guid, name);
        return name;
    };

    // JP names map (FFLogs fallback)
    const jpMap = new Map();
    for (const ev of rawJp) {
        const g = ev.ability?.guid ?? ev.abilityGameID;
        const n = ev.ability?.name?.trim();
        if (g !== undefined && isValidName(n) && !jpMap.has(g)) jpMap.set(g, n);
    }

    // Normalize — priority: XIVAPI dict > FFLogs JP > FFLogs EN
    const ref = fight.startTime;
    const GROUPING_WINDOW_MS = 800;
    const TB_DAMAGE_RATIO = 1.5;

    const norm = alive.filter(ev => ev.timestamp >= ref).map(ev => {
        const ms = ev.timestamp - ref;
        const a = isAutoAttack(ev);
        const g = ev.ability?.guid ?? ev.abilityGameID ?? -1;
        const en = a ? 'AA' : (ev.ability?.name?.trim() || 'Unknown');

        // スキル名解決（優先度: XIVAPI > FFLogs JP > FFLogs EN）
        // _rsv_ で始まる無効名は各段階でスキップ
        let jpN, enN;
        if (a) {
            jpN = 'AA';
            enN = 'AA';
        } else {
            const xiv = xivApiDict.get(g);
            const ffJp = jpMap.get(g);
            const ffEn = isValidName(en) ? en : null;

            const unknownFallback = getUnknownName(g);

            // JP名: XIVAPI → FFLogs JP → FFLogs EN → Unknown_XX
            jpN = (xiv && isValidName(xiv.ja)) ? xiv.ja
                : (ffJp && !AA_NAMES.has(ffJp)) ? ffJp
                : ffEn || unknownFallback;

            // EN名: XIVAPI → FFLogs EN → FFLogs JP → Unknown_XX
            enN = (xiv && isValidName(xiv.en)) ? xiv.en
                : ffEn ? ffEn
                : (ffJp && !AA_NAMES.has(ffJp)) ? ffJp
                : unknownFallback;
        }

        return {
            timeSec: Math.floor(ms / 1000), timeMs: ms, rawDmg: getRawDamage(ev),
            aa: a, enName: enN, jpName: jpN, guid: g,
            aType: ev.ability?.type, tgtID: ev.targetID ?? -1
        };
    });

    // MT/ST identification（時系列追跡でタンクスイッチ検出）
    // まず全AA被弾者からタンク2名を特定（被弾数Top2）
    const hits = new Map();
    for (const n of norm) {
        if (!n.aa) continue;
        const e = hits.get(n.tgtID);
        if (!e) hits.set(n.tgtID, { c: 1, f: n.timeMs });
        else e.c++;
    }
    const sorted = [...hits.entries()].sort((a, b) => b[1].c - a[1].c || a[1].f - b[1].f);
    const tankA = sorted[0]?.[0] ?? null; // AA被弾が最も多い = 初期MT
    const tankB = sorted[1]?.[0] ?? null;
    const tanks = new Set();
    if (tankA !== null) tanks.add(tankA);
    if (tankB !== null) tanks.add(tankB);

    // AAイベントを時系列で並べ、現在のAA対象を追跡
    // 初期MT(tankA)がAAを受けている間 → その人=MT, もう一方=ST
    // AA対象が切り替わった時点でスイッチ発生
    const aaEvents = norm.filter(n => n.aa).sort((a, b) => a.timeMs - b.timeMs);
    let currentMtId = tankA; // 初期MTはAA被弾数最多の人

    // 各時刻でのMT/ST状態を記録するMap（timeSec → currentMtId）
    const mtAtTime = new Map();
    for (const ev of aaEvents) {
        if (ev.tgtID === tankA || ev.tgtID === tankB) {
            currentMtId = ev.tgtID; // AA対象が切り替わった = スイッチ
        }
        mtAtTime.set(ev.timeSec, currentMtId);
    }

    // 指定時刻でのMT/STを返すヘルパー
    // AAイベントがない時刻では直前の状態を引き継ぐ
    const allAaTimeSecs = [...mtAtTime.keys()].sort((a, b) => a - b);
    function getMtIdAt(timeSec) {
        // その時刻以前で最も近いAA時刻を探す
        let result = tankA; // デフォルトは初期MT
        for (const t of allAaTimeSecs) {
            if (t > timeSec) break;
            result = mtAtTime.get(t);
        }
        return result;
    }

    // 後方互換: mtId/stIdは初期MT/STとして保持（非AA技のtarget判定に使用）
    const mtId = tankA;
    const stId = tankB;

    // Pre-compute damage info
    const admg = new Map();
    for (const n of norm) {
        let d = admg.get(n.guid);
        if (!d) { d = { mt: 0, pt: 0, hT: false, hP: false }; admg.set(n.guid, d); }
        if (tanks.has(n.tgtID)) { d.hT = true; if (n.rawDmg > d.mt) d.mt = n.rawDmg; }
        else { d.hP = true; if (n.rawDmg > d.pt) d.pt = n.rawDmg; }
    }

    const tbSet = new Set();
    const dmgT = new Map();
    const dmgP = new Map();
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

    // Group non-AA
    const nonAA = norm.filter(n => !n.aa).sort((a, b) => a.timeMs - b.timeMs);
    const used = new Set();
    const groups = [];
    for (let i = 0; i < nonAA.length; i++) {
        if (used.has(i)) continue;
        const gr = [nonAA[i]]; used.add(i);
        for (let j = i + 1; j < nonAA.length; j++) {
            if (used.has(j) || nonAA[j].guid !== nonAA[i].guid) continue;
            if (nonAA[j].timeMs - nonAA[i].timeMs > GROUPING_WINDOW_MS) break;
            gr.push(nonAA[j]); used.add(j);
        }
        groups.push(gr);
    }

    // Post-merge same-ability same-timeSec
    for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
            if (groups[i][0].guid !== groups[j][0].guid) continue;
            if (groups[i][0].timeSec !== groups[j][0].timeSec) continue;
            groups[i].push(...groups[j]);
            groups.splice(j, 1); j--;
        }
    }

    // Build timeline
    const tl = [];

    for (const gr of groups) {
        const f = gr[0], g = f.guid, tb = tbSet.has(g);
        const uTgts = new Set(gr.map(n => n.tgtID));
        const tHits = gr.filter(n => tanks.has(n.tgtID));
        const pHits = gr.filter(n => !tanks.has(n.tgtID));

        if (tb && tHits.length > 0 && pHits.length > 0) {
            const td = dmgT.get(g) ?? 0;
            for (const tid of new Set(tHits.map(n => n.tgtID))) {
                tl.push({
                    time: f.timeSec, name: { ja: `${f.jpName} (TB)`, en: `${f.enName} (TB)` },
                    damageType: mapDamageType(f.aType),
                    damageAmount: td > 0 ? td : undefined, target: tid === stId ? 'ST' : 'MT'
                });
            }
            const pd = dmgP.get(g) ?? 0;
            tl.push({
                time: f.timeSec + 1, name: { ja: f.jpName, en: f.enName },
                damageType: mapDamageType(f.aType), damageAmount: pd > 0 ? pd : undefined, target: 'AoE'
            });
        } else if (tb && tHits.length > 0) {
            const td = dmgT.get(g) ?? 0;
            for (const tid of new Set(tHits.map(n => n.tgtID))) {
                tl.push({
                    time: f.timeSec, name: { ja: `${f.jpName} (TB)`, en: `${f.enName} (TB)` },
                    damageType: mapDamageType(f.aType),
                    damageAmount: td > 0 ? td : undefined, target: tid === stId ? 'ST' : 'MT'
                });
            }
        } else if (uTgts.size >= 3) {
            const d = dmgP.get(g) ?? 0;
            tl.push({
                time: f.timeSec, name: { ja: f.jpName, en: f.enName },
                damageType: mapDamageType(f.aType), damageAmount: d > 0 ? d : undefined, target: 'AoE'
            });
        } else if (uTgts.size === 2 && [...uTgts].every(id => tanks.has(id))) {
            const d = dmgP.get(g) ?? 0;
            for (const tid of uTgts) {
                tl.push({
                    time: f.timeSec, name: { ja: f.jpName, en: f.enName },
                    damageType: mapDamageType(f.aType), damageAmount: d > 0 ? d : undefined,
                    target: tid === stId ? 'ST' : 'MT'
                });
            }
        } else {
            const [tid] = uTgts;
            const d = dmgP.get(g) ?? 0;
            const target = tid === stId ? 'ST' : (tid === mtId ? 'MT' : 'AoE');
            tl.push({
                time: f.timeSec, name: { ja: f.jpName, en: f.enName },
                damageType: mapDamageType(f.aType), damageAmount: d > 0 ? d : undefined, target
            });
        }
    }

    // AA events（全件出力。タンクスイッチを時系列追跡で反映）
    // 同時に両タンクにAAが来るボス（M4S前半等）にも対応
    const aaGuid = norm.find(n => n.aa)?.guid ?? -1;
    const aaInfo = admg.get(aaGuid);
    const aaMax = Math.max(aaInfo?.mt ?? 0, aaInfo?.pt ?? 0);
    const aaBD = Math.floor((aaMax / 1.05) * 0.8);

    // timeSec:tgtID でグループ化（同秒・同対象のAAをまとめる）
    const aaGr = new Map();
    for (const n of norm) {
        if (!n.aa) continue;
        const k = `${n.timeSec}:${n.tgtID}`;
        if (!aaGr.has(k)) aaGr.set(k, []);
        aaGr.get(k).push(n);
    }
    for (const [k, gr] of aaGr) {
        const [s, t] = k.split(':');
        const sec = parseInt(s, 10), tid = parseInt(t, 10);
        const curMt = getMtIdAt(sec);
        const target = tid === curMt ? 'MT' : 'ST';
        tl.push({
            time: sec, name: { ja: gr[0].jpName, en: gr[0].enName },
            damageType: mapDamageType(gr[0].aType), damageAmount: aaBD > 0 ? aaBD : undefined,
            target
        });
    }

    // Sort
    tl.sort((a, b) => a.time !== b.time ? a.time - b.time : ({ 'AoE': 0, 'MT': 1, 'ST': 2 }[a.target] ?? 0) - ({ 'AoE': 0, 'MT': 1, 'ST': 2 }[b.target] ?? 0));

    // ── ダメージなし詠唱イベントの追加 ──
    if (castEn.length > 0) {
        const damageGuids = new Set(norm.map(n => n.guid));
        const castJpMap = new Map();
        for (const ev of castJp) {
            const g = ev.ability?.guid ?? ev.abilityGameID;
            const n = ev.ability?.name?.trim();
            if (g !== undefined && n && !castJpMap.has(g)) castJpMap.set(g, n);
        }

        const castSorted = castEn
            .filter(ev => {
                const g = ev.ability?.guid ?? ev.abilityGameID ?? -1;
                const name = ev.ability?.name?.trim() ?? '';
                if (damageGuids.has(g)) return false;
                if (AA_NAMES.has(name) || !name) return false;
                if (ev.type !== 'begincast') return false;
                return true;
            })
            .sort((a, b) => a.timestamp - b.timestamp);

        const seenCasts = new Set();
        for (const ev of castSorted) {
            const g = ev.ability?.guid ?? ev.abilityGameID ?? -1;
            const timeSec = Math.floor((ev.timestamp - fight.startTime) / 1000);
            const key = `${g}:${timeSec}`;
            if (seenCasts.has(key)) continue;
            seenCasts.add(key);

            const enName = ev.ability?.name?.trim() ?? 'Unknown';
            const jpName = castJpMap.get(g) ?? xivApiDict.get(g) ?? enName;

            tl.push({
                id: `tpl_cast_${Math.random().toString(36).slice(2, 8)}`,
                time: timeSec,
                name: { ja: jpName, en: enName },
                damageType: 'magical',
                target: 'AoE',
            });
        }

        tl.sort((a, b) => a.time !== b.time ? a.time - b.time : ({ 'AoE': 0, 'MT': 1, 'ST': 2 }[a.target] ?? 0) - ({ 'AoE': 0, 'MT': 1, 'ST': 2 }[b.target] ?? 0));
    }

    return tl;
}
