import type { Phase, LocalizedString } from '../types';

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
 * - 中間フェーズ: 次のフェーズのstartTime
 * - 最終フェーズ: startTime + 1
 */
export function ensurePhaseEndTimes(phases: Array<Omit<Phase, 'endTime'> & { endTime?: number }>): Phase[] {
    if (phases.length === 0) return [];
    const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
    return sorted.map((p, i) => {
        if (p.endTime !== undefined) return p as Phase;
        const next = sorted[i + 1];
        return { ...p, endTime: next ? next.startTime : p.startTime + 1 } as Phase;
    });
}

/**
 * 旧Phase（endTimeベース）→ 新Phase（startTimeベース）に変換。
 * 新形式のデータはそのまま返す。純粋関数。
 * endTimeが未設定の場合は自動補完する。
 */
export function migratePhases(phases: any[]): Phase[] {
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

    return ensurePhaseEndTimes(result);
}
