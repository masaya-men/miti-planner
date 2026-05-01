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

export interface MemberLike {
    id: string;
    jobId: string | null;
}

/**
 * 初期選択メンバー集合を決定する。
 * myMemberId がアクティブメンバー（jobId 設定済み）と一致すれば自分のみ、
 * そうでなければ全アクティブメンバーを返す。
 */
export function computeInitialSelection(
    myMemberId: string | null,
    members: MemberLike[],
): Set<string> {
    const activeIds = members.filter(m => m.jobId).map(m => m.id);
    if (myMemberId && activeIds.includes(myMemberId)) {
        return new Set([myMemberId]);
    }
    return new Set(activeIds);
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * PiP 背景色のデフォルト値を返す。
 * localStorage に有効な色が保存されていればそれを優先、
 * なければテーマに応じてダーク/ライト用デフォルトを返す。
 */
export function getDefaultBgColor(theme: 'dark' | 'light', stored: string | null): string {
    if (stored && HEX_COLOR_RE.test(stored)) return stored;
    return theme === 'light' ? '#FAFAFA' : '#0F0F10';
}
