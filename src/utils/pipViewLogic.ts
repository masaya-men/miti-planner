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

/** AA(オートアタック)イベント判定。generateAAEvents が name を ja/en とも 'AA' でセットする。 */
function isAAEvent(e: TimelineEvent): boolean {
    return e.name?.ja === 'AA' || e.name?.en === 'AA';
}

/**
 * カンペ行を「攻撃ドリブン」で算出する。
 * 行 = 非AA攻撃のある全時刻 ∪ 選択メンバーの軽減が置かれた時刻。
 * - events: その時刻の非AAイベントのみ（優先度順: AoE > 単体 > 未設定、同列 id 昇順）。AAだけ/無しの時刻では空配列。
 * - mitigations: その時刻の選択メンバー分のみ。
 * 各行は events と mitigations の少なくとも一方が非空。時刻昇順で返す。
 * メンバー選択は軽減アイコンの絞り込みのみで、攻撃行は選択に依存しない。
 */
export function computeCueItems(
    events: TimelineEvent[],
    mitigations: AppliedMitigation[],
    selectedMemberIds: Set<string>,
): CueGroup[] {
    const filteredMitis = mitigations.filter(m => selectedMemberIds.has(m.ownerId));

    // 非AAイベントを時刻ごとに集約
    const nonAAByTime = new Map<number, TimelineEvent[]>();
    for (const e of events) {
        if (isAAEvent(e)) continue;
        const list = nonAAByTime.get(e.time) ?? [];
        list.push(e);
        nonAAByTime.set(e.time, list);
    }

    // 行にする時刻 = 非AA攻撃のある時刻 ∪ 選択メンバー軽減のある時刻
    const times = new Set<number>(nonAAByTime.keys());
    for (const m of filteredMitis) times.add(m.time);

    return [...times]
        .sort((a, b) => a - b)
        .map(time => ({
            time,
            events: [...(nonAAByTime.get(time) ?? [])].sort((a, b) => {
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
