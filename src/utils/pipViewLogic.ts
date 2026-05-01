import type { TimelineEvent, AppliedMitigation } from '../types';

export interface CueItem {
    event: TimelineEvent;
    mitigations: AppliedMitigation[];
}

/**
 * 選択メンバー集合に紐づく軽減を時刻ごとにマージし、
 * 軽減が配置されたイベントだけを時刻昇順で返す。
 */
export function computeCueItems(
    events: TimelineEvent[],
    mitigations: AppliedMitigation[],
    selectedMemberIds: Set<string>,
): CueItem[] {
    if (selectedMemberIds.size === 0) return [];

    const filteredMitis = mitigations.filter(m => selectedMemberIds.has(m.ownerId));
    if (filteredMitis.length === 0) return [];

    const mitiTimes = new Set(filteredMitis.map(m => m.time));

    return events
        .filter(e => mitiTimes.has(e.time))
        .sort((a, b) => a.time - b.time)
        .map(event => ({
            event,
            mitigations: filteredMitis.filter(m => m.time === event.time),
        }));
}
