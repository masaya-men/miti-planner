/**
 * shared_plan の hidden フラグ判定ヘルパー（管理画面で hidden=true にされたプランは
 * ボトムシート野良主流から除外する）。
 */

export interface HiddenAware {
    hidden?: boolean;
}

/** hidden が true でなければ可視。undefined / false は可視扱い。 */
export function isVisible<T extends HiddenAware>(item: T): boolean {
    return item.hidden !== true;
}

/** hidden=true を弾いた配列を返す（純粋関数）。 */
export function filterVisible<T extends HiddenAware>(items: T[]): T[] {
    return items.filter(isVisible);
}

/** YYYY-MM-DD (UTC基準) 形式の日付キーを返す */
export function todayKey(): string {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/** today から n 日前の日付キー */
export function dayKeyDaysBefore(n: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * 直近7日コピー数（score7d）を copyCountByDay の bucket から計算する。
 * windowStart 以降のキーのみ加算するため、呼び出し側で windowStart = dayKeyDaysBefore(6) を渡すこと。
 */
export function calculateScore7d(
    byDay: Record<string, number> | undefined | null,
    windowStart: string,
): number {
    if (!byDay) return 0;
    let score = 0;
    for (const [key, n] of Object.entries(byDay)) {
        if (key >= windowStart) score += n;
    }
    return score;
}
