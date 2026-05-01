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
