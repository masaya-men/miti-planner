import type { Label, Phase, TimelineEvent } from '../types';

/**
 * PlanDataがラベル未移行の旧形式かどうかを判定。
 * labels[]プロパティが存在しない（undefined）場合は旧形式と判断する。
 */
export function isLegacyLabelFormat(data: { labels?: any[]; timelineEvents: any[] }): boolean {
    return data.labels === undefined;
}

/**
 * TimelineEvent.mechanicGroupからLabel[]を生成する。純粋関数。
 *
 * ルール:
 * - mechanicGroup.jaの値が変わる地点をstartTimeとしてLabel作成
 * - フェーズ境界でラベルは区切る（同名ラベルでも別フェーズなら別Label）
 * - mechanicGroupがないイベントは隙間として扱う（Labelを作成しない）
 */
export function migrateLabels(timelineEvents: TimelineEvent[], phases: Phase[]): Label[] {
    if (timelineEvents.length === 0) return [];

    // 時刻順にソート
    const sorted = [...timelineEvents].sort((a, b) => a.time - b.time);

    const labels: Array<Omit<Label, 'endTime'>> = [];
    let currentLabelName: string | null = null;
    let currentPhaseId: string | null = null;

    for (const event of sorted) {
        // mechanicGroupがないイベントは隙間として扱う
        if (!event.mechanicGroup) {
            currentLabelName = null;
            continue;
        }

        const eventGroupName = event.mechanicGroup.ja;
        const eventPhaseId = getPhaseIdForTime(event.time, phases);

        const isNewLabel =
            eventGroupName !== currentLabelName ||
            eventPhaseId !== currentPhaseId;

        if (isNewLabel) {
            labels.push({
                id: crypto.randomUUID(),
                name: {
                    ja: event.mechanicGroup.ja,
                    en: event.mechanicGroup.en || '',
                    ...(event.mechanicGroup.zh ? { zh: event.mechanicGroup.zh } : {}),
                    ...(event.mechanicGroup.ko ? { ko: event.mechanicGroup.ko } : {}),
                },
                startTime: event.time,
            });
            currentLabelName = eventGroupName;
            currentPhaseId = eventPhaseId;
        }
    }

    // 最終ラベルは最終イベント時刻まで伸ばす（startTime+1 の見切れ防止）
    const maxEventTime = sorted[sorted.length - 1].time;
    return ensureLabelEndTimes(labels, maxEventTime);
}

/**
 * endTimeが未定義のラベルにendTimeを補完する。
 * - 中間ラベル: 次のラベルのstartTime
 * - 最終ラベル: maxTime が指定されていれば max(maxTime, startTime+1)、未指定なら startTime + 1
 */
export function ensureLabelEndTimes(
    labels: Array<Omit<Label, 'endTime'> & { endTime?: number }>,
    maxTime?: number,
): Label[] {
    if (labels.length === 0) return [];
    const sorted = [...labels].sort((a, b) => a.startTime - b.startTime);
    return sorted.map((l, i) => {
        if (l.endTime !== undefined) return l as Label;
        const next = sorted[i + 1];
        if (next) return { ...l, endTime: next.startTime } as Label;
        const fallback = maxTime !== undefined
            ? Math.max(maxTime, l.startTime + 1)
            : l.startTime + 1;
        return { ...l, endTime: fallback } as Label;
    });
}

/** イベントの時刻がどのフェーズに属するかをIDで返す。フェーズがない場合はnull */
function getPhaseIdForTime(time: number, phases: Phase[]): string | null {
    if (phases.length === 0) return null;

    // startTimeの降順でソートして、最初にtime以下のフェーズを返す
    const sorted = [...phases].sort((a, b) => b.startTime - a.startTime);
    for (const phase of sorted) {
        if (time >= phase.startTime) {
            return phase.id;
        }
    }
    return null;
}
