import type { Mitigation, AppliedMitigation } from '../../types';
import { matchesCopiesShieldSource } from '../../utils/scholarShieldRules';

/**
 * copiesShieldスキル（展開戦術等）の自動リンクを解決する。
 * - リンク先が有効ならそのまま
 * - リンク先が無効になった or リンク未設定 → 有効なコピー元が1つなら自動リンク
 * - 0個 or 2個以上 → リンク解除（ユーザー選択待ち）
 */
export const resolveShieldLinks = (
    mitigations: AppliedMitigation[],
    mitigationDefs: Mitigation[],
): AppliedMitigation[] => {
    let changed = false;
    const result = mitigations.map(m => {
        const def = mitigationDefs.find(d => d.id === m.mitigationId);
        if (!def?.copiesShield) return m;

        // 現在のリンクが有効か確認
        if (m.linkedMitigationId) {
            const linked = mitigations.find(l => l.id === m.linkedMitigationId);
            if (linked && matchesCopiesShieldSource(linked.mitigationId, def.copiesShield) &&
                linked.time <= m.time && linked.time + linked.duration > m.time) {
                // リンク有効 — durationを鼓舞の残り時間に同期
                const remainingDuration = Math.max(1, linked.time + linked.duration - m.time);
                if (m.duration !== remainingDuration) {
                    changed = true;
                    return { ...m, duration: remainingDuration };
                }
                return m;
            }
        }

        // 有効なコピー元を検索
        const available = mitigations.filter(l =>
            l.id !== m.id &&
            matchesCopiesShieldSource(l.mitigationId, def.copiesShield!) &&
            l.time <= m.time &&
            l.time + l.duration > m.time
        );

        if (available.length === 1) {
            changed = true;
            const remainingDuration = Math.max(1, available[0].time + available[0].duration - m.time);
            return { ...m, linkedMitigationId: available[0].id, duration: remainingDuration };
        }

        // 0個 or 2+個: リンク解除
        if (m.linkedMitigationId) {
            changed = true;
            return { ...m, linkedMitigationId: undefined };
        }
        return m;
    });

    return changed ? result : mitigations;
};
