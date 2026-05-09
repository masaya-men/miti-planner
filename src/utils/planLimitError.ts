/**
 * planService.createPlan が PLAN_LIMIT 上限到達時に投げる Error メッセージを
 * `{ reason, current, max }` 構造化オブジェクトに復元する純粋関数。
 *
 * メッセージ形式:
 *   `PLAN_LIMIT_max_total|current=50|max=50`
 *   `PLAN_LIMIT_max_per_content|current=5|max=5`
 *
 * 上記以外 (Firestore SDK のネットワーク系エラー / permission-denied など) は null を返す。
 * UI 側ではこの返り値が null かどうかで「上限到達 → 件数付き専用文言」と
 * 「その他失敗 → 汎用フィードバック (通信確認・再ログイン・時間置く)」を出し分ける。
 */
export type PlanLimitReason = 'max_total' | 'max_per_content';

export interface ParsedPlanLimit {
    reason: PlanLimitReason;
    current: number;
    max: number;
}

const RE = /^PLAN_LIMIT_(max_total|max_per_content)\|current=(\d+)\|max=(\d+)/;

export function parsePlanLimitError(error: string | undefined | null): ParsedPlanLimit | null {
    if (!error) return null;
    const m = error.match(RE);
    if (!m) return null;
    return {
        reason: m[1] as PlanLimitReason,
        current: Number(m[2]),
        max: Number(m[3]),
    };
}
