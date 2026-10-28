import type { FFLogsRawEvent } from '../api/fflogsTypes';
import type { TimelineEvent } from '../types';
import { roundDamageCeil } from './damageRounding';
import { AA_NAMES, AA_PROXIMITY_MS, isAutoAttackName, genId } from './fflogsMapperBasics';
import type { Norm } from './fflogsMapperTypes';

// ─────────────────────────────────────────────
// 内部関数
// ─────────────────────────────────────────────

/** 英語ログ検出（V5.0） */
export function detectEnglishOnly(castEn: FFLogsRawEvent[], castJp: FFLogsRawEvent[]): boolean {
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
export function buildName(
    src: { jpName: string; enName: string },
    isEnglishOnly: boolean,
    suffix: string = '',
): TimelineEvent['name'] {
    const ja = isEnglishOnly ? src.enName + suffix : src.jpName + suffix;
    const en = src.enName + suffix;
    return { ja, en };
}

/** AAイベント生成（V5.0方式） */
export function generateAAEvents(
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
export function addNonDamageCasts(
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
            guid: g !== -1 ? g : undefined,
        });
    }
}
