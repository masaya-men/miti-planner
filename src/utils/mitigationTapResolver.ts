import type { Mitigation, AppliedMitigation } from '../types';

/**
 * 軽減スキルをタップ/クリックしたときに「即配置」か「対象選択が必要」か「鼓舞選択が必要」かを判定する純粋関数。
 *
 * デスクトップ版 MitigationSelector.handleMitigationClick と同じ分岐:
 * - copiesShield (展開戦術など): 対象時刻に有効な鼓舞が1つだけなら自動リンクして配置、0個 or 2個以上なら選択UIへ。
 * - scope === 'target' (インターベンションなど): 対象 (パーティメンバー) 選択へ。
 * - それ以外 (self / party / 未定義): 即配置。
 *
 * モバイルの軽減追加フローでもこの判定を共有し、対象選択ステップ欠落バグを防ぐ。
 */
export type MitigationTapResolution =
    | { kind: 'place'; linkedMitigationId?: string }
    | { kind: 'selectTarget' }
    | { kind: 'selectShield'; shields: AppliedMitigation[] };

export function resolveMitigationTap(
    mit: Mitigation,
    time: number,
    timelineMitigations: AppliedMitigation[],
): MitigationTapResolution {
    if (mit.copiesShield) {
        const shields = timelineMitigations.filter(l =>
            l.mitigationId === mit.copiesShield &&
            l.time <= time &&
            l.time + l.duration > time
        );
        if (shields.length === 1) {
            return { kind: 'place', linkedMitigationId: shields[0].id };
        }
        return { kind: 'selectShield', shields };
    }

    if (mit.scope === 'target') {
        return { kind: 'selectTarget' };
    }

    return { kind: 'place' };
}
