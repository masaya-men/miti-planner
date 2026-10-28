import type { FFLogsFight } from '../api/fflogsTypes';
import type { LocalizedString } from '../types';

/** フェーズ自動生成（V5.1: report.phasesからボス名取得） */
export function buildPhases(fight: FFLogsFight): { id: number; startTimeSec: number; name: LocalizedString }[] {
    const transitions = fight.phaseTransitions;
    const phaseNames = fight.phaseNames;

    if (!transitions || transitions.length === 0) {
        // フェーズ遷移なし — phaseNamesがあれば最初の名前を使用
        const name = phaseNames?.[0]?.name;
        return [{ id: 1, startTimeSec: 0, name: { ja: '', en: cleanPhaseName(name) || 'P1' } }];
    }

    return transitions.map(pt => {
        const nameEntry = phaseNames?.find(p => p.id === pt.id);
        return {
            id: pt.id,
            startTimeSec: Math.floor((pt.startTime - fight.startTime) / 1000),
            name: { ja: '', en: cleanPhaseName(nameEntry?.name) || `P${pt.id}` },
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
