import type { TimelineEvent, AppliedMitigation } from '../types';

export interface CueGroup {
    /** イベントの発生時刻（同じ時刻のイベントは 1 グループにまとまる） */
    time: number;
    /** 優先度順に並んだイベント（先頭が主表示）。AoE > 単体(MT/ST) > target未設定、同優先度内は id 昇順 */
    events: TimelineEvent[];
    /** 同時刻に配置された軽減（選択メンバー分のみ） */
    mitigations: AppliedMitigation[];
}

/** 同時刻イベントの表示優先度。0=AoE 最優先、1=単体、2=未設定 */
function eventPriority(e: TimelineEvent): number {
    if (e.target === 'AoE') return 0;
    if (e.target === 'MT' || e.target === 'ST') return 1;
    return 2;
}

/**
 * 選択メンバー集合に紐づく軽減を時刻ごとにマージし、
 * 軽減が配置された時刻だけをグループ化して時刻昇順で返す。
 * 同時刻に複数イベントがある場合、優先度順（AoE > 単体 > 未設定、同列は id 昇順）で events に並べる。
 */
export function computeCueItems(
    events: TimelineEvent[],
    mitigations: AppliedMitigation[],
    selectedMemberIds: Set<string>,
): CueGroup[] {
    if (selectedMemberIds.size === 0) return [];

    const filteredMitis = mitigations.filter(m => selectedMemberIds.has(m.ownerId));
    if (filteredMitis.length === 0) return [];

    const mitiTimes = new Set(filteredMitis.map(m => m.time));
    const eventsByTime = new Map<number, TimelineEvent[]>();
    for (const e of events) {
        if (!mitiTimes.has(e.time)) continue;
        const list = eventsByTime.get(e.time) ?? [];
        list.push(e);
        eventsByTime.set(e.time, list);
    }

    return [...eventsByTime.entries()]
        .sort(([a], [b]) => a - b)
        .map(([time, evs]) => ({
            time,
            events: [...evs].sort((a, b) => {
                const pd = eventPriority(a) - eventPriority(b);
                if (pd !== 0) return pd;
                return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
            }),
            mitigations: filteredMitis.filter(m => m.time === time),
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

/**
 * 背景色が明るい（白寄り）かどうかを YIQ 輝度で判定する。
 * 明るい背景なら文字色を暗色（#171717）に、暗い背景なら明色（#F0F0F0）に切り替える用途。
 * 不正な値は false（暗い扱い）にフォールバック。
 */
export function isBgLight(hex: string): boolean {
    if (!HEX_COLOR_RE.test(hex)) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}
