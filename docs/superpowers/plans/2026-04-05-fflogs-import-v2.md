# FFLogsインポート v2 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FFLogsインポートを「ダメージ起点」から「キャスト起点」に刷新し、タンク判定・TB判定・連続ダメージの精度を大幅に向上させる。

**Architecture:** `fflogs.ts` に `fetchPlayerDetails` を追加。`fflogsMapper.ts` を全面書き換え（キャスト骨格 → ダメージ紐付け → 波検出）。`FFLogsImportModal.tsx` で呼び出しフロー更新と英語ログ警告追加。

**Tech Stack:** TypeScript, React, FFLogs GraphQL API v2

**設計書:** `docs/superpowers/specs/2026-04-05-fflogs-import-v2.md`

---

## ファイル構成

| ファイル | 変更種別 | 責務 |
|---------|---------|------|
| `src/api/fflogs.ts` | 修正 | `fetchPlayerDetails()` 追加、`PlayerDetails` 型追加 |
| `src/utils/fflogsMapper.ts` | 全面書き換え | キャスト起点マッピングロジック |
| `src/components/FFLogsImportModal.tsx` | 修正 | playerDetails呼び出し、英語ログ警告、フェーズ受け渡し |
| `src/locales/ja.json` | 修正 | 英語ログ警告メッセージ追加 |
| `src/locales/en.json` | 修正 | 同上 |
| `src/locales/zh.json` | 修正 | 同上 |
| `src/locales/ko.json` | 修正 | 同上 |

---

### Task 1: fetchPlayerDetails API追加

**Files:**
- Modify: `src/api/fflogs.ts:360-420` (DeathEvents セクションの後に追加)

- [ ] **Step 1: PlayerDetails 型と GraphQL クエリを追加**

`src/api/fflogs.ts` の末尾（`resolveFight` 関数の前、行422付近）に以下を追加:

```typescript
// ─────────────────────────────────────────────────────────────
// Player details query (role identification)
// ─────────────────────────────────────────────────────────────

export interface PlayerInfo {
    id: number;      // イベントの sourceID/targetID と一致
    name: string;
    type: string;    // ジョブ名 (e.g. "Warrior", "WhiteMage")
}

export interface PlayerDetails {
    tanks: PlayerInfo[];
    healers: PlayerInfo[];
    dps: PlayerInfo[];
}

const PLAYER_DETAILS_QUERY = /* graphql */`
  query GetPlayerDetails($reportCode: String!, $fightIDs: [Int]!) {
    reportData {
      report(code: $reportCode) {
        playerDetails(fightIDs: $fightIDs)
      }
    }
  }
`;

interface PlayerDetailsQueryResult {
    reportData: { report: { playerDetails: PlayerDetails } };
}

/**
 * Fetch player details (roles + jobs) for a specific fight.
 * Returns players grouped by role: tanks, healers, dps.
 */
export async function fetchPlayerDetails(
    reportCode: string,
    fightId: number
): Promise<PlayerDetails> {
    const token = await getAccessToken();
    const data = await gql<PlayerDetailsQueryResult>(token, PLAYER_DETAILS_QUERY, {
        reportCode,
        fightIDs: [fightId],
    });
    return data.reportData.report.playerDetails;
}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/api/fflogs.ts
git commit -m "feat: add fetchPlayerDetails API for role identification"
```

---

### Task 2: fflogsMapper.ts 全面書き換え

**Files:**
- Rewrite: `src/utils/fflogsMapper.ts`

- [ ] **Step 1: 新しい fflogsMapper.ts を書く**

`src/utils/fflogsMapper.ts` を以下の内容で全面置換:

```typescript
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
    const damageEntries: DamageEntry[] = filteredDamage.map(ev => ({
        timeMs: ev.timestamp - ref,
        guid: ev.ability?.guid ?? ev.abilityGameID ?? -1,
        rawDmg: getRawDamage(ev),
        tgtID: ev.targetID ?? -1,
        aType: ev.ability?.type,
    }));
    const castDamageMap = matchDamageToCasts(casts, damageEntries);

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

            tl.push({
                id: genId(),
                time: waveTimeSec,
                name: buildName(cast, isEnglishOnly, waveTarget === 'MT' || waveTarget === 'ST' ? ' (TB)' : ''),
                damageType: mapDamageType(cast.aType),
                damageAmount: dmgValue > 0 ? roundDamageCeil(dmgValue) : undefined,
                target: waveTarget,
            });
        }
    }

    // ── Step 5: AA処理 ──
    const aaCount = generateAAEvents(tl, aaDamage, tankIds, mtId, stId, enNameMap, jpNameMap, isEnglishOnly);

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

/** キャストイベントからキャスト一覧を構築（AA除外、begincastのみ） */
function buildCastList(
    castEn: FFLogsRawEvent[],
    castJp: FFLogsRawEvent[],
    jpNameMap: Map<number, string>,
    enNameMap: Map<number, string>,
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

    for (const ev of castEn) {
        if (ev.type !== 'begincast') continue;
        const g = ev.ability?.guid ?? ev.abilityGameID ?? -1;
        const enName = ev.ability?.name?.trim() ?? '';
        if (!enName || isAutoAttackName(enName)) continue;

        const ms = ev.timestamp - ref;
        if (ms < 0) continue;
        const timeSec = Math.floor(ms / 1000);

        // 同GUID・同秒の重複キャストを除外
        const key = `${g}:${timeSec}`;
        if (seen.has(key)) continue;
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
    }

    casts.sort((a, b) => a.timeMs - b.timeMs);
    return casts;
}

/** ダメージイベントをキャストに紐付ける */
function matchDamageToCasts(
    casts: CastEntry[],
    damages: DamageEntry[],
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
        if (isAutoAttackName(/* check by guid */'' )) continue; // AAは別処理
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
    mtId: number | null,
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
    mtId: number | null,
    stId: number | null,
): TimelineEvent['target'] {
    if (damages.length === 0) return castTarget;

    const uniqueTargets = new Set(damages.map(d => d.tgtID));
    const playerTargets = new Set([...uniqueTargets].filter(id => allPlayerIds.has(id)));

    // 8人 or 3人以上 → AoE
    if (playerTargets.size >= 3) return 'AoE';

    // タンクのみに当たっている
    const tankOnly = [...playerTargets].every(id => tankIds.has(id));
    if (tankOnly && playerTargets.size > 0) {
        if (playerTargets.size === 1) {
            const [tid] = playerTargets;
            return tid === stId ? 'ST' : 'MT';
        }
        // 両タンクに当たっている場合はキャスト対象で判定
        return castTarget;
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

    return waves;
}

/** 波のダメージ基準値を算出 */
function computeDamageValue(
    damages: DamageEntry[],
    target: TimelineEvent['target'],
    tankIds: Set<number>,
): number {
    if (damages.length === 0) return 0;

    if (target === 'MT' || target === 'ST') {
        // TB: タンクへのダメージの最大値
        const tankDmg = damages
            .filter(d => tankIds.has(d.tgtID))
            .map(d => d.rawDmg);
        if (tankDmg.length > 0) return Math.max(...tankDmg);
    }

    // AoE: 全ダメージの最大値
    return Math.max(...damages.map(d => d.rawDmg));
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
    mtId: number | null,
    stId: number | null,
    enNameMap: Map<number, string>,
    jpNameMap: Map<number, string>,
    isEnglishOnly: boolean,
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
```

**注意**: `matchDamageToCasts` 内の `isAutoAttackName('')` 部分は、ダメージのGUIDからAA判定するように修正が必要。以下の修正を適用:

`matchDamageToCasts` 関数のダメージループ内を修正:

```typescript
    for (const d of damages) {
        // AAのダメージは別処理（generateAAEvents）なのでスキップ
        const en = enNameMap?.get(d.guid) ?? '';
        if (isAutoAttackName(en)) continue;
```

ただしこの関数は `enNameMap` にアクセスできない。解決策: `matchDamageToCasts` に `aaGuid` を渡す:

```typescript
function matchDamageToCasts(
    casts: CastEntry[],
    damages: DamageEntry[],
    aaGuids: Set<number>,
): Map<CastEntry, DamageEntry[]> {
```

呼び出し側:
```typescript
    const aaGuids = new Set<number>();
    for (const d of damageEntries) {
        const en = enNameMap.get(d.guid) ?? '';
        if (isAutoAttackName(en)) aaGuids.add(d.guid);
    }
    const castDamageMap = matchDamageToCasts(casts, damageEntries, aaGuids);
```

関数内:
```typescript
    for (const d of damages) {
        if (aaGuids.has(d.guid)) continue;
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/utils/fflogsMapper.ts
git commit -m "feat: rewrite fflogsMapper to cast-first approach (V5.0)"
```

---

### Task 3: FFLogsImportModal 更新

**Files:**
- Modify: `src/components/FFLogsImportModal.tsx:99-135`

- [ ] **Step 1: インポート文に PlayerDetails を追加**

`FFLogsImportModal.tsx` 冒頭のインポート文を修正:

```typescript
// 既存:
import { fetchFightEvents, fetchDeathEvents, fetchCastEvents, resolveFight } from '../api/fflogs';
import type { MapperResult } from '../utils/fflogsMapper';

// 変更後:
import { fetchFightEvents, fetchDeathEvents, fetchCastEvents, fetchPlayerDetails, resolveFight } from '../api/fflogs';
import type { MapperResult } from '../utils/fflogsMapper';
```

- [ ] **Step 2: handleFetch を更新**

`handleFetch` 関数（行99-135）を以下に置換:

```typescript
    const handleFetch = async () => {
        if (!parsedData || !isLoggedIn) return;

        if (getRemainingImports() <= 0) {
            setStatus({ phase: 'error', message: t('fflogs.rate_limit_exceeded', { max: IMPORT_RATE_LIMIT }) });
            return;
        }

        try {
            recordImport();
            setStatus({ phase: 'loading', message: t('fflogs.resolving') });
            const fight = await resolveFight(
                parsedData.reportId,
                parsedData.fightId
            );

            // プレイヤー情報取得（タンク/ヒーラー/DPS判定用）
            setStatus({ phase: 'loading', message: t('fflogs.fetching_players') });
            const players = await fetchPlayerDetails(parsedData.reportId, fight.id);

            // 全イベント並行取得
            setStatus({ phase: 'loading', message: t('fflogs.fetching', { lang: 'JP+EN', name: fight.name }) });
            const [eventsJp, eventsEn, deaths, castEn, castJp] = await Promise.all([
                fetchFightEvents(parsedData.reportId, fight, false),
                fetchFightEvents(parsedData.reportId, fight, true),
                fetchDeathEvents(parsedData.reportId, fight),
                fetchCastEvents(parsedData.reportId, fight, true),
                fetchCastEvents(parsedData.reportId, fight, false),
            ]);

            setStatus({ phase: 'loading', message: t('fflogs.mapping') });
            const mapped = mapFFLogsToTimeline(eventsEn, eventsJp, fight, deaths, castEn, castJp, players);

            setStatus({ phase: 'preview', fight, events: eventsEn, mapped });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setStatus({ phase: 'error', message });
        }
    };
```

- [ ] **Step 3: 英語ログ警告をプレビューUIに追加**

`FFLogsImportModal.tsx` のプレビュー表示部分（`status.phase === 'preview'` の中）に、既存の `warning_overwrite` メッセージの後に追加:

```tsx
{status.mapped.stats.isEnglishOnly && (
    <p className="text-app-lg text-amber-400">
        {t('fflogs.english_only_warning')}
    </p>
)}
```

- [ ] **Step 4: tryAutoRegisterTemplate にフェーズを渡す**

`tryAutoRegisterTemplate` 内の `body` で `phases: []` を `phases: mapped.phases` に変更:

```typescript
body: JSON.stringify({
    contentId,
    category,
    timelineEvents: mapped.events,
    phases: mapped.phases,  // ← 変更
    kill: fight.kill === true,
    deathCount: 0,
    sourceReport: reportId,
}),
```

- [ ] **Step 5: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/components/FFLogsImportModal.tsx
git commit -m "feat: update FFLogsImportModal for cast-first mapper + english log warning"
```

---

### Task 4: i18n メッセージ追加

**Files:**
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/zh.json`, `src/locales/ko.json`

- [ ] **Step 1: 4言語に新メッセージを追加**

各ファイルの `"fflogs"` セクション内に追加:

**ja.json** (`"rate_limit_exceeded"` の後):
```json
"fetching_players": "プレイヤー情報を取得中...",
"english_only_warning": "英語でアップロードされたログのため、日本語の技名を取得できません。テンプレートエディターで後から翻訳を追加できます。"
```

**en.json**:
```json
"fetching_players": "Fetching player info...",
"english_only_warning": "This log was uploaded from an English client. Japanese ability names are not available. You can add translations later in the template editor."
```

**zh.json**:
```json
"fetching_players": "获取玩家信息...",
"english_only_warning": "此日志来自英语客户端，无法获取日语技能名称。您可以稍后在模板编辑器中添加翻译。"
```

**ko.json**:
```json
"fetching_players": "플레이어 정보 가져오는 중...",
"english_only_warning": "영어 클라이언트에서 업로드된 로그입니다. 일본어 스킬 이름을 가져올 수 없습니다. 나중에 템플릿 편집기에서 번역을 추가할 수 있습니다."
```

- [ ] **Step 2: ビルド確認**

Run: `npx vite build 2>&1 | tail -5`
Expected: `✓ built in` が表示される

- [ ] **Step 3: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
git commit -m "feat: add i18n messages for player details + english log warning"
```

---

### Task 5: 統合テスト・動作確認

- [ ] **Step 1: TypeScript型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 2: Vite ビルド**

Run: `npx vite build`
Expected: ビルド成功

- [ ] **Step 3: 本番動作確認（手動）**

以下のケースを確認:
1. M3S ログ: キングオブアルカディアが開幕1行のみ
2. 連続ダメージ技: 波ごとに複数行になること
3. TB判定: タンク対象技が MT/ST で表示されること
4. DSR: フェーズが正しく分割されること
5. 英語ログ: 警告メッセージが表示されること

- [ ] **Step 4: 最終コミット（必要に応じて修正）**

```bash
git add -A
git commit -m "fix: post-integration adjustments for fflogs import v2"
```
