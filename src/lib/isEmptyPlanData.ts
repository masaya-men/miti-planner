import type { PlanData } from '../types';

/**
 * プランの「中身が空か」を判定する (空上書きガード用)。
 *
 * 業界標準の防御 (non-empty check / hydration gate): 起動時 desync 等で空になった
 * 作業ストアが、本物の保存データを黙って上書きする事故を防ぐために使う。
 *
 * 注: getSnapshot() は中身ゼロでも currentLevel / aaSettings 等のキーを持つため、
 * `Object.keys(data).length === 0` では「空」を検出できない。
 * 「ユーザーが意味を持って入れる要素」= イベント / 軽減 / パーティメンバー / フェーズ が
 * すべて空のときに「空」とみなす。
 */
export function isEmptyPlanData(data: PlanData | undefined | null): boolean {
    if (!data) return true;
    return (
        (data.timelineEvents?.length ?? 0) === 0 &&
        (data.timelineMitigations?.length ?? 0) === 0 &&
        (data.partyMembers?.length ?? 0) === 0 &&
        (data.phases?.length ?? 0) === 0
    );
}
