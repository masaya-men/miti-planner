/**
 * src/utils/fflogsMapper.ts — V5.0
 *
 * Cast-first mapping: キャスト（詠唱）イベントを骨格にし、
 * ダメージイベントを後から紐付ける方式。
 *
 * Key improvements from V4.8:
 *  - playerDetails API でタンク/ヒーラー/DPS を確定（AA推測不要）
 *  - キャストの targetID で TB を直接判定
 *  - 連続ダメージ（複数波）を波ごとに別行として出力
 *  - phaseTransitions でフェーズを自動割り当て
 */

import type { FFLogsRawEvent, FFLogsFight, DeathEvent, PlayerDetails } from '../api/fflogs';
import type { TimelineEvent } from '../types';
import { roundDamageCeil } from './damageRounding';

// ─────────────────────────────────────────────
// 定数・ユーティリティ
// ─────────────────────────────────────────────

const AA_NAMES = new Set(['Attack', 'Shot', '攻撃', 'Attaque', 'Attacke']);
const AA_PROXIMITY_MS = 500;
const WAVE_GAP_MS = 500; // 連続ダメージの波を区切る間隔

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

interface CastEntry {
    timeSec: number;
    timeMs: number;
    guid: number;
    enName: string;
    jpName: string;
    aType: number | undefined;
    targetID: number;  // キャストの対象プレイヤーID（0=AoE系）
    sourceID: number;  // キャスト元の敵ID
}

interface DamageEntry {
    timeMs: number;
    guid: number;
    rawDmg: number;
    tgtID: number;
    aType: number | undefined;
}

/** 1つの波（同一キャストから生じたダメージの1グループ） */
interface DamageWave {
    timeMs: number;       // 波の代表時刻
    damages: DamageEntry[];
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

    // ── プレイヤー情報セットアップ ──
    const tankIds = new Set(players.tanks.map(p => p.id));
    const healerIds = new Set(players.healers.map(p => p.id));
    const dpsIds = new Set(players.dps.map(p => p.id));
    const allPlayerIds = new Set([...tankIds, ...healerIds, ...dpsIds]);

    // ── 言語検出 ──
    const isEnglishOnly = detectEnglishOnly(castEn, castJp);

    // ── JP名マップ構築 ──
    const jpNameMap = new Map<number, string>();
    for (const ev of [...castJp, ...rawJp]) {
        const g = ev.ability?.guid ?? ev.abilityGameID;
        const n = ev.ability?.name?.trim();
        if (g !== undefined && n && !jpNameMap.has(g)) jpNameMap.set(g, n);
    }

    // ── EN名マップ構築 ──
    const enNameMap = new Map<number, string>();
    for (const ev of [...castEn, ...rawEn]) {
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
    const filteredDamage = dd.filter(ev =>
        ev.tick !== true &&
        ev.timestamp >= ref &&
        (ev.unmitigatedAmount !== undefined || ev.amount !== undefined ||
            ev.absorbed !== undefined || ev.mitigated !== undefined) &&
        getRawDamage(ev) < 999999 &&
        !isTargetDead(ev.targetID ?? -1, ev.timestamp)
    );

    // ── Step 1: キャスト一覧を骨格にする ──
    const casts = buildCastList(castEn, castJp, jpNameMap, enNameMap, ref);

    // ── Step 2: ダメージをキャストに紐付け ──
    // DEBUG: 各ダメージイベントのFFLogs生値を記録
    const _debugRawMap = new Map<string, FFLogsRawEvent>();
    const damageEntries: DamageEntry[] = filteredDamage.map(ev => {
        const entry = {
            timeMs: ev.timestamp - ref,
            guid: ev.ability?.guid ?? ev.abilityGameID ?? -1,
            rawDmg: getRawDamage(ev),
            tgtID: ev.targetID ?? -1,
            aType: ev.ability?.type,
        };
        _debugRawMap.set(`${entry.timeMs}:${entry.guid}:${entry.tgtID}`, ev);
        return entry;
    });

    const aaGuids = new Set<number>();
    for (const d of damageEntries) {
        const en = enNameMap.get(d.guid) ?? '';
        if (isAutoAttackName(en)) aaGuids.add(d.guid);
    }
    const castDamageMap = matchDamageToCasts(casts, damageEntries, aaGuids);

    // DEBUG: キャストに紐付かなかったダメージイベントを集計
    const matchedSet = new Set<DamageEntry>();
    for (const entries of castDamageMap.values()) {
        for (const e of entries) matchedSet.add(e);
    }
    const unmatchedDamage = damageEntries.filter(d =>
        !matchedSet.has(d) && !aaGuids.has(d.guid) && d.rawDmg > 0
    );
    if (unmatchedDamage.length > 0) {
        const summary = new Map<string, { count: number; maxDmg: number; minTime: number; guids: Set<number> }>();
        for (const d of unmatchedDamage) {
            const name = jpNameMap.get(d.guid) ?? enNameMap.get(d.guid) ?? `GUID:${d.guid}`;
            if (!summary.has(name)) summary.set(name, { count: 0, maxDmg: 0, minTime: Infinity, guids: new Set() });
            const s = summary.get(name)!;
            s.count++;
            s.maxDmg = Math.max(s.maxDmg, d.rawDmg);
            s.minTime = Math.min(s.minTime, d.timeMs);
            s.guids.add(d.guid);
        }
        console.log(`[DEBUG UNMATCHED] キャストに紐付かなかったダメージ (${unmatchedDamage.length}件):`);
        for (const [name, s] of summary) {
            console.log(
                `  ${name} | count=${s.count} | maxDmg=${s.maxDmg} | firstAt=${Math.floor(s.minTime / 1000)}s | GUIDs=${[...s.guids].join(',')}`,
            );
        }
    }

    // DEBUG: begincast以外のキャストイベント数
    const castOnlyCount = castEn.filter(ev => ev.type === 'cast').length;
    const beginCastCount = castEn.filter(ev => ev.type === 'begincast').length;
    console.log(`[DEBUG CAST] begincast=${beginCastCount}, cast(即発動)=${castOnlyCount}, total=${castEn.length}`);

    // ── Step 3: MT/ST判定（AA被弾パターン） ──
    const aaDamage = damageEntries.filter(d => {
        const en = enNameMap.get(d.guid) ?? '';
        return isAutoAttackName(en);
    });
    const { mtId, stId } = identifyMtSt(aaDamage, tankIds);

    // ── Step 4: タイムラインイベント生成 ──
    const tl: TimelineEvent[] = [];

    for (const cast of casts) {
        const damages = castDamageMap.get(cast) ?? [];
        const target = determineCastTarget(cast.targetID, tankIds, mtId, stId);

        if (damages.length === 0) {
            // ダメージなしキャスト（フェーズ移行演出等）
            tl.push({
                id: genId(),
                time: cast.timeSec,
                name: buildName(cast, isEnglishOnly),
                damageType: mapDamageType(cast.aType),
                target: 'AoE',
            });
            continue;
        }

        // 連続ダメージの波検出
        const waves = detectDamageWaves(damages);

        for (const wave of waves) {
            const waveTimeSec = Math.floor(wave.timeMs / 1000);
            const waveTarget = resolveWaveTarget(wave.damages, target, tankIds, allPlayerIds, mtId, stId);
            const dmgValue = computeDamageValue(wave.damages, waveTarget, tankIds);
            const rounded = dmgValue > 0 ? roundDamageCeil(dmgValue) : undefined;

            // DEBUG: ダメージ算出過程をログ出力
            if (wave.damages.length > 0) {
                const debugDetails = wave.damages.map(d => {
                    const raw = _debugRawMap.get(`${d.timeMs}:${d.guid}:${d.tgtID}`);
                    return {
                        tgtID: d.tgtID,
                        rawDmg: d.rawDmg,
                        fflogs_amount: raw?.amount,
                        fflogs_unmitigated: raw?.unmitigatedAmount,
                        fflogs_absorbed: raw?.absorbed,
                        fflogs_mitigated: raw?.mitigated,
                        fflogs_multiplier: raw?.multiplier,
                        fflogs_hitType: raw?.hitType,
                    };
                });
                console.log(
                    `[DEBUG DMG] ${cast.jpName} @${waveTimeSec}s | target=${waveTarget} | median=${dmgValue} → rounded=${rounded}`,
                );
                console.table(debugDetails);
            }

            tl.push({
                id: genId(),
                time: waveTimeSec,
                name: buildName(cast, isEnglishOnly, waveTarget === 'MT' || waveTarget === 'ST' ? ' (TB)' : ''),
                damageType: mapDamageType(cast.aType),
                damageAmount: rounded,
                target: waveTarget,
            });
        }
    }

    // ── Step 5: AA処理 ──
    const aaCount = generateAAEvents(tl, aaDamage, tankIds, mtId, stId, isEnglishOnly);

    // ── Step 5.5: 同名技のダメージ統一 ──
    unifyDamageForSameAbility(tl);

    // ── Step 6: ソート ──
    tl.sort((a, b) => a.time - b.time);

    // ── Step 7: スケジューリング（同秒競合解消） ──
    resolveSchedulingConflicts(tl);

    // ── Step 8: フェーズ自動生成 ──
    const phases = buildPhases(fight);

    return {
        events: tl,
        phases,
        stats: {
            totalRawEvents: rawEn.length,
            filteredEvents: filteredDamage.length,
            timelineEventCount: tl.length,
            aaCount,
            mechanicCount: tl.length - aaCount,
            mtId,
            stId,
            isEnglishOnly,
        },
    };
}

// ─────────────────────────────────────────────
// 内部関数
// ─────────────────────────────────────────────

/** 英語ログ検出: translate=true と translate=false の技名が同一か比較 */
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
    let matchCount = 0;
    let checkCount = 0;
    for (const ev of castJp) {
        const g = ev.ability?.guid;
        const n = ev.ability?.name?.trim();
        if (g !== undefined && n && enNames.has(g)) {
            checkCount++;
            if (enNames.get(g) === n) matchCount++;
            if (checkCount >= 5) break;
        }
    }
    // 5件中5件が同一 → 英語ログ
    return checkCount >= 3 && matchCount === checkCount;
}

/** キャストイベントからキャスト一覧を構築（AA除外、begincast優先＋cast補完） */
function buildCastList(
    castEn: FFLogsRawEvent[],
    castJp: FFLogsRawEvent[],
    jpNameMap: Map<number, string>,
    _enNameMap: Map<number, string>,
    ref: number,
): CastEntry[] {
    const castJpMap = new Map<number, string>();
    for (const ev of castJp) {
        const g = ev.ability?.guid ?? ev.abilityGameID;
        const n = ev.ability?.name?.trim();
        if (g !== undefined && n && !castJpMap.has(g)) castJpMap.set(g, n);
    }

    const casts: CastEntry[] = [];
    const seen = new Set<string>();

    const addCast = (ev: FFLogsRawEvent) => {
        const g = ev.ability?.guid ?? ev.abilityGameID ?? -1;
        const enName = ev.ability?.name?.trim() ?? '';
        if (!enName || isAutoAttackName(enName)) return;

        const ms = ev.timestamp - ref;
        if (ms < 0) return;
        const timeSec = Math.floor(ms / 1000);

        // 同GUID・同秒の重複キャストを除外
        const key = `${g}:${timeSec}`;
        if (seen.has(key)) return;
        seen.add(key);

        const jpName = castJpMap.get(g) ?? jpNameMap.get(g) ?? enName;

        casts.push({
            timeSec,
            timeMs: ms,
            guid: g,
            enName,
            jpName: isAutoAttackName(jpName) ? 'AA' : jpName,
            aType: ev.ability?.type,
            targetID: ev.targetID ?? 0,
            sourceID: ev.sourceID ?? 0,
        });
    };

    // Pass 1: begincast を優先登録（詠唱開始時刻が正確）
    for (const ev of castEn) {
        if (ev.type === 'begincast') addCast(ev);
    }

    // Pass 2: cast（即発動）を補完登録（begincastがないGUID・秒のみ追加）
    for (const ev of castEn) {
        if (ev.type === 'cast') addCast(ev);
    }

    casts.sort((a, b) => a.timeMs - b.timeMs);
    return casts;
}

/** ダメージイベントをキャストに紐付ける */
function matchDamageToCasts(
    casts: CastEntry[],
    damages: DamageEntry[],
    aaGuids: Set<number>,
): Map<CastEntry, DamageEntry[]> {
    const result = new Map<CastEntry, DamageEntry[]>();
    for (const c of casts) result.set(c, []);

    // 各GUIDごとにキャストを時系列でインデックス化
    const castsByGuid = new Map<number, CastEntry[]>();
    for (const c of casts) {
        if (!castsByGuid.has(c.guid)) castsByGuid.set(c.guid, []);
        castsByGuid.get(c.guid)!.push(c);
    }

    const MAX_WINDOW_MS = 10000; // キャスト後最大10秒

    for (const d of damages) {
        if (aaGuids.has(d.guid)) continue; // AAは別処理
        const guidCasts = castsByGuid.get(d.guid);
        if (!guidCasts) continue; // キャストのないダメージ（稀）はスキップ

        // このダメージに最も適切なキャストを探す
        let bestCast: CastEntry | null = null;
        for (let i = guidCasts.length - 1; i >= 0; i--) {
            const c = guidCasts[i];
            if (c.timeMs <= d.timeMs && d.timeMs - c.timeMs <= MAX_WINDOW_MS) {
                // 次のキャストがあればそこで区切る
                const nextCast = guidCasts[i + 1];
                if (nextCast && d.timeMs >= nextCast.timeMs) continue;
                bestCast = c;
                break;
            }
        }

        if (bestCast) {
            result.get(bestCast)!.push(d);
        }
    }

    return result;
}

/** キャストの targetID からターゲットタイプを判定 */
function determineCastTarget(
    targetID: number,
    tankIds: Set<number>,
    _mtId: number | null,
    stId: number | null,
): TimelineEvent['target'] {
    if (targetID === 0) return 'AoE';
    if (tankIds.has(targetID)) {
        return targetID === stId ? 'ST' : 'MT';
    }
    return 'AoE'; // DPS/ヒーラー対象のキャストはAoE扱い
}

/** 波ごとのターゲットを確定（ダメージ件数ベース） */
function resolveWaveTarget(
    damages: DamageEntry[],
    castTarget: TimelineEvent['target'],
    tankIds: Set<number>,
    allPlayerIds: Set<number>,
    _mtId: number | null,
    stId: number | null,
): NonNullable<TimelineEvent['target']> {
    if (damages.length === 0) return castTarget ?? 'AoE';

    const uniqueTargets = new Set(damages.map(d => d.tgtID));
    const playerTargets = new Set([...uniqueTargets].filter(id => allPlayerIds.has(id)));

    // 8人 or 3人以上 → AoE
    if (playerTargets.size >= 3) return 'AoE';

    // タンクのみに当たっている → TB扱い
    const tankOnly = [...playerTargets].every(id => tankIds.has(id));
    if (tankOnly && playerTargets.size > 0) {
        if (playerTargets.size === 1) {
            const [tid] = playerTargets;
            return tid === stId ? 'ST' : 'MT';
        }
        // 両タンクに当たっている → MT（共有TB）
        return 'MT';
    }

    // キャスト対象がTBだがダメージが広範囲 → AoE部分
    if (castTarget === 'MT' || castTarget === 'ST') {
        if (playerTargets.size >= 3) return 'AoE';
        return castTarget;
    }

    return 'AoE';
}

/** 連続ダメージの波を検出 */
function detectDamageWaves(damages: DamageEntry[]): DamageWave[] {
    if (damages.length === 0) return [];

    const sorted = [...damages].sort((a, b) => a.timeMs - b.timeMs);
    const waves: DamageWave[] = [];
    let currentWave: DamageEntry[] = [sorted[0]];
    let currentWaveStart = sorted[0].timeMs;

    for (let i = 1; i < sorted.length; i++) {
        // 同じ波: 最初のイベントからWAVE_GAP_MS以内
        if (sorted[i].timeMs - currentWaveStart <= WAVE_GAP_MS) {
            currentWave.push(sorted[i]);
        } else {
            waves.push({ timeMs: currentWaveStart, damages: currentWave });
            currentWave = [sorted[i]];
            currentWaveStart = sorted[i].timeMs;
        }
    }
    waves.push({ timeMs: currentWaveStart, damages: currentWave });

    return mergeAoEWaves(waves);
}

/**
 * パケット到着順のずれで分かれたAoE波をマージする。
 * 例: タンクだけ先にダメージパケットが到着 → 小波(1-2人) + 大波(残り) に分かれる
 * → 全波の合計ユニークターゲットが3人以上なら1つのAoE波にマージ
 */
function mergeAoEWaves(waves: DamageWave[]): DamageWave[] {
    if (waves.length <= 1) return waves;

    // 全波を通じたユニークプレイヤー数
    const allTargets = new Set<number>();
    for (const w of waves) {
        for (const d of w.damages) allTargets.add(d.tgtID);
    }

    // 3人以上なら全体がAoEの一部 → 1つにマージ
    if (allTargets.size >= 3) {
        const allDamages = waves.flatMap(w => w.damages);
        return [{ timeMs: waves[0].timeMs, damages: allDamages }];
    }

    return waves;
}

/** 中央値を算出 */
function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? Math.floor((sorted[mid - 1] + sorted[mid]) / 2)
        : sorted[mid];
}

/** 波のダメージ基準値を算出 */
function computeDamageValue(
    damages: DamageEntry[],
    target: TimelineEvent['target'],
    tankIds: Set<number>,
): number {
    if (damages.length === 0) return 0;

    if (target === 'MT' || target === 'ST') {
        // TB: タンクへのダメージの最大値（対象1-2人なので中央値不適）
        const tankDmg = damages
            .filter(d => tankIds.has(d.tgtID))
            .map(d => d.rawDmg);
        if (tankDmg.length > 0) return Math.max(...tankDmg);
    }

    // AoE: タンクを除外した中央値（タンクは防御力が高くダメージが低い）
    const nonTankDmg = damages.filter(d => !tankIds.has(d.tgtID)).map(d => d.rawDmg);
    if (nonTankDmg.length > 0) return median(nonTankDmg);
    // 全員タンクの場合はフォールバック
    return median(damages.map(d => d.rawDmg));
}

/** イベント名を構築 */
function buildName(
    cast: CastEntry,
    isEnglishOnly: boolean,
    suffix: string = '',
): TimelineEvent['name'] {
    const ja = isEnglishOnly ? cast.enName + suffix : cast.jpName + suffix;
    const en = cast.enName + suffix;
    return { ja, en };
}

/** MT/ST判定: AA被弾パターンから */
function identifyMtSt(
    aaDamage: DamageEntry[],
    tankIds: Set<number>,
): { mtId: number | null; stId: number | null } {
    const hits = new Map<number, number>();
    for (const d of aaDamage) {
        if (!tankIds.has(d.tgtID)) continue;
        hits.set(d.tgtID, (hits.get(d.tgtID) ?? 0) + 1);
    }

    const sorted = [...hits.entries()].sort((a, b) => b[1] - a[1]);
    const mtId = sorted[0]?.[0] ?? null;
    const stId = sorted[1]?.[0] ?? null;
    return { mtId, stId };
}

/** AAイベント生成 */
function generateAAEvents(
    tl: TimelineEvent[],
    aaDamage: DamageEntry[],
    tankIds: Set<number>,
    _mtId: number | null,
    stId: number | null,
    _isEnglishOnly: boolean,
): number {
    // 500ms以内のAAを同一キャストとして統一
    const sorted = [...aaDamage].sort((a, b) => a.timeMs - b.timeMs);
    const groups: DamageEntry[][] = [];
    let gs = 0;
    for (let i = 1; i <= sorted.length; i++) {
        if (i === sorted.length || sorted[i].timeMs - sorted[gs].timeMs > AA_PROXIMITY_MS) {
            groups.push(sorted.slice(gs, i));
            gs = i;
        }
    }

    // ターゲットごとにグループ化して1行ずつ生成
    let aaCount = 0;
    for (const group of groups) {
        const byTarget = new Map<number, DamageEntry[]>();
        for (const d of group) {
            if (!tankIds.has(d.tgtID)) continue; // タンク以外のAA無視
            if (!byTarget.has(d.tgtID)) byTarget.set(d.tgtID, []);
            byTarget.get(d.tgtID)!.push(d);
        }

        for (const [tid, entries] of byTarget) {
            const timeSec = Math.floor(entries[0].timeMs / 1000);
            const maxDmg = Math.max(...entries.map(d => d.rawDmg));
            const baseDmg = Math.floor((maxDmg / 1.05) * 0.8);
            const target: TimelineEvent['target'] = tid === stId ? 'ST' : 'MT';

            tl.push({
                id: genId(),
                time: timeSec,
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

/** 同名技のダメージを統一（エンレージ等の大幅差異は維持） */
function unifyDamageForSameAbility(tl: TimelineEvent[]): void {
    const DEVIATION_THRESHOLD = 0.20; // 中央値から20%以上離れたら個別値を維持

    // 同名+同target でグループ化（AAは除外）
    const groups = new Map<string, number[]>();
    for (let i = 0; i < tl.length; i++) {
        const ev = tl[i];
        if (!ev.damageAmount || ev.name.ja === 'AA' || ev.name.en === 'AA') continue;
        const key = `${ev.name.ja}::${ev.target ?? 'AoE'}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(i);
    }

    for (const [, indices] of groups) {
        if (indices.length < 2) continue;

        const values = indices.map(i => tl[i].damageAmount!);
        const med = median(values);
        if (med === 0) continue;

        // 全イベントが中央値から20%以内なら統一
        const allClose = values.every(v => Math.abs(v - med) / med <= DEVIATION_THRESHOLD);
        if (allClose) {
            const unified = roundDamageCeil(med);
            for (const i of indices) {
                tl[i].damageAmount = unified;
            }
        }
        // 20%超の差異がある場合は各値をそのまま維持
    }
}

/** 同秒競合を解消 */
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
            const hasAA = ix.some(i => isAA(tl[i]));

            // TB + AoE 同秒 → AoE を +1s
            if (hasNonAATank && hasAoE) {
                for (const i of ix) {
                    if (tl[i].target === 'AoE' && !isAA(tl[i])) { tl[i].time += 1; changed = true; }
                }
            }
            // AoE + AA 同秒 → AA を +1s
            if (hasAoE && hasAA) {
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
            const isAAev = (ev: TimelineEvent) => ev.name.ja === 'AA' || ev.name.en === 'AA';
            const sorted = [...ix].sort((a, b) => {
                const aA = isAAev(tl[a]), bA = isAAev(tl[b]);
                if (aA !== bA) return aA ? 1 : -1;
                return a - b;
            });
            for (let k = 2; k < sorted.length; k++) {
                tl[sorted[k]].time += 1;
                changed = true;
            }
        }
    }

    tl.sort((a, b) => a.time - b.time);
}

/** phaseTransitions からフェーズ情報を生成 */
function buildPhases(fight: FFLogsFight): { id: number; startTimeSec: number; name: string }[] {
    const transitions = fight.phaseTransitions;
    if (!transitions || transitions.length === 0) {
        return [{ id: 1, startTimeSec: 0, name: 'P1' }];
    }

    return transitions.map(pt => ({
        id: pt.id,
        startTimeSec: Math.floor((pt.startTime - fight.startTime) / 1000),
        name: `P${pt.id}`,
    }));
}
