/**
 * 新規 id。crypto.randomUUID があれば UUID、無ければ `prefix` 付きの乱数文字列。
 * prefix は乱数フォールバックの時だけ付く(UUID には付かない)。
 * withTimestamp: fflogs 取り込み用。乱数部を 9 桁にして末尾に時刻(36進)を足す。
 */
export function genId(prefix = 'id_', withTimestamp = false): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    if (withTimestamp) return prefix + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
    return prefix + Math.random().toString(36).substring(2, 9);
}
