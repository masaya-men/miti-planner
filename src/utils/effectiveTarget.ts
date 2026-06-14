import type { TimelineEvent, AppliedMitigation, Phase } from '../types';

type Tank = 'MT' | 'ST';

/** time が属するフェーズの id を返す（startTime <= time < endTime）。無ければ null。 */
function phaseIdOfTime(time: number, phases: Phase[]): string | null {
    for (const p of phases) {
        if (time >= p.startTime && time < p.endTime) return p.id;
    }
    return null;
}

/**
 * 挑発（isTankSwap マーカー）を考慮した「実効ターゲット」を返す純粋関数。
 * - target が MT/ST 以外（AoE/undefined）はそのまま返す。
 * - 同一フェーズ内・当該イベントより前（time 厳密に小さい）の挑発数が
 *   奇数なら MT⇄ST 反転、偶数なら元のまま。
 * - swapMarkers が空なら必ず元 target を返す = 既存挙動と完全一致。
 *
 * @param swapMarkers isTankSwap のスキルだけを事前フィルタした配置
 */
export function getEffectiveTarget(
    event: TimelineEvent,
    swapMarkers: AppliedMitigation[],
    phases: Phase[],
): TimelineEvent['target'] {
    const target = event.target;
    if (target !== 'MT' && target !== 'ST') return target;
    if (swapMarkers.length === 0) return target;

    const eventPhase = phaseIdOfTime(event.time, phases);
    let count = 0;
    for (const m of swapMarkers) {
        if (m.time >= event.time) continue; // 厳密に前のみ
        if (phaseIdOfTime(m.time, phases) !== eventPhase) continue; // 同一フェーズのみ
        count++;
    }
    if (count % 2 === 0) return target;
    return target === 'MT' ? 'ST' : ('MT' as Tank);
}

/** events 全件の eventId → 実効ターゲット の Map を作る（呼び出し側でメモ化前提）。 */
export function buildEffectiveTargetMap(
    events: TimelineEvent[],
    swapMarkers: AppliedMitigation[],
    phases: Phase[],
): Map<string, TimelineEvent['target']> {
    const map = new Map<string, TimelineEvent['target']>();
    for (const e of events) {
        map.set(e.id, getEffectiveTarget(e, swapMarkers, phases));
    }
    return map;
}
