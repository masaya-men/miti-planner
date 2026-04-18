import type { Phase, LocalizedString, TimelineEvent } from '../types';

/** 旧形式（endTimeベース）かどうかを判定 */
export function isLegacyPhaseFormat(phases: any[]): boolean {
    if (phases.length === 0) return false;
    const first = phases[0];
    return ('endTime' in first) && !('startTime' in first);
}

/** Phase.name を string | LocalizedString から LocalizedString に正規化 */
function normalizePhaseName(name: any): LocalizedString {
    if (typeof name === 'string') {
        // [object Object] 混入をクリーニング
        const cleaned = name.replace(/\n?\[object Object\]/g, '').trim();
        return { ja: cleaned, en: '' };
    }
    if (name && typeof name === 'object' && ('ja' in name || 'en' in name)) {
        return {
            ja: name.ja || '',
            en: name.en || '',
            ...(name.zh ? { zh: name.zh } : {}),
            ...(name.ko ? { ko: name.ko } : {}),
        };
    }
    return { ja: '', en: '' };
}

/**
 * endTimeが未定義のフェーズにendTimeを補完する。
 * - 中間フェーズ: 次のフェーズのstartTime - 1（描画 endTime+1 と整合する隣接規約）
 * - 最終フェーズ: maxTime が指定されていれば max(maxTime, startTime+1)、未指定なら startTime + 1
 */
export function ensurePhaseEndTimes(
    phases: Array<Omit<Phase, 'endTime'> & { endTime?: number }>,
    maxTime?: number,
): Phase[] {
    if (phases.length === 0) return [];
    const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
    return sorted.map((p, i) => {
        if (p.endTime !== undefined) return p as Phase;
        const next = sorted[i + 1];
        if (next) return { ...p, endTime: next.startTime - 1 } as Phase;
        const fallback = maxTime !== undefined
            ? Math.max(maxTime, p.startTime + 1)
            : p.startTime + 1;
        return { ...p, endTime: fallback } as Phase;
    });
}

/**
 * 旧Phase（endTimeベース）→ 新Phase（startTimeベース）に変換。
 * 新形式のデータはそのまま返す。純粋関数。
 * endTimeが未設定の場合は自動補完する。maxTime を渡すと最終フェーズのフォールバックに使われる。
 */
export function migratePhases(phases: any[], maxTime?: number): Phase[] {
    if (phases.length === 0) return [];

    let result: Array<Omit<Phase, 'endTime'> & { endTime?: number }>;

    if (!isLegacyPhaseFormat(phases)) {
        result = phases.map(p => ({
            id: p.id,
            name: normalizePhaseName(p.name),
            startTime: p.startTime,
            ...(p.endTime !== undefined ? { endTime: p.endTime } : {}),
        }));
    } else {
        // 旧形式: endTime順にソート済みと仮定
        const sorted = [...phases].sort((a: any, b: any) => a.endTime - b.endTime);
        result = sorted.map((p: any, i: number) => ({
            id: p.id,
            name: normalizePhaseName(p.name),
            startTime: i === 0 ? 0 : sorted[i - 1].endTime,
        }));
    }

    return ensurePhaseEndTimes(result, maxTime);
}

/**
 * 過去のバグ（ensurePhaseEndTimes が最終フェーズの endTime を startTime+1 に設定していた）で
 * 保存されたプランを修復する。
 * 条件: 最終フェーズの endTime が startTime+1（バグ値）かつ、その後にイベントがある。
 * ユーザーが意図的に 1 秒幅のフェーズを設定したケースでは後続イベントが無いため修復されない。
 */
export function repairLastPhaseEndTime(
    phases: Phase[],
    timelineEvents: Pick<TimelineEvent, 'time'>[],
    maxTime: number,
): Phase[] {
    if (phases.length === 0) return phases;
    const lastIdx = phases.length - 1;
    const last = phases[lastIdx];
    const isBugValue = last.endTime === last.startTime + 1;
    if (!isBugValue) return phases;
    const hasEventsAfter = timelineEvents.some(e => e.time > last.endTime);
    if (!hasEventsAfter) return phases;
    const repaired = [...phases];
    repaired[lastIdx] = {
        ...last,
        endTime: Math.max(maxTime, last.startTime + 1),
    };
    return repaired;
}

/**
 * 旧隣接規約（phase[i].endTime === phase[i+1].startTime）で保存された
 * プランを新規約（phase[i].endTime + 1 === phase[i+1].startTime）に修復する。
 *
 * 描画仕様（Timeline.tsx: endTime + 1 まで描画）と整合させ、境界の罫線が
 * 覆い隠される問題を解消する。厳密な等号のみ修復し、gap やオーバーラップは触らない。
 */
export function repairAdjacentPhaseBoundaries(phases: Phase[]): Phase[] {
    if (phases.length < 2) return phases;
    const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
    return sorted.map((p, i) => {
        const next = sorted[i + 1];
        if (next && p.endTime === next.startTime) {
            return { ...p, endTime: p.endTime - 1 };
        }
        return p;
    });
}
