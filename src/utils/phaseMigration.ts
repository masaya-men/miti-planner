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
 * 旧Phase（endTimeベース）→ 新Phase（startTimeベース）に変換。
 * 新形式のデータはそのまま返す。純粋関数。
 */
export function migratePhases(phases: any[]): Phase[] {
    if (phases.length === 0) return [];

    // 新形式ならそのまま返す
    if (!isLegacyPhaseFormat(phases)) {
        return phases.map(p => ({
            id: p.id,
            name: normalizePhaseName(p.name),
            startTime: p.startTime,
            ...(p.endTime !== undefined ? { endTime: p.endTime } : {}),
        }));
    }

    // 旧形式: endTime順にソート済みと仮定
    const sorted = [...phases].sort((a: any, b: any) => a.endTime - b.endTime);
    return sorted.map((p: any, i: number) => ({
        id: p.id,
        name: normalizePhaseName(p.name),
        startTime: i === 0 ? 0 : sorted[i - 1].endTime,
    }));
}
