/**
 * プラン同期マージ (純粋関数・2026-06-03)
 *
 * 業界水準 local-first の中核。「未同期」と「他端末で削除 (墓標)」を
 * 明示シグナル (墓標 = サーバ側 deleted フラグ) で区別する。
 *
 * 旧実装の致命的欠陥:
 *   「リモートに無い = 削除された」と推測していたため、
 *   - 未同期ローカル (まだ上げてない) を「削除」と誤判定して drop (= 消失)
 *   - 削除をリモート反映できないまま残った plan を「他端末作成」と誤判定して re-add (= 復活)
 *
 * 新しい原則:
 *   - 削除は必ず墓標 (deleted=true) として伝播する。
 *   - リモートに live が無く墓標も無い = 未同期 → drop せず保持 (キューで再送)。
 *   - 墓標がある = 削除確定 → ローカルからも除去・復活させない。
 */
import type { SavedPlan } from '../types';

export interface MergeResult {
    merged: SavedPlan[];
    changed: boolean;
}

/**
 * @param localPlans ローカル (localStorage) のプラン
 * @param remotePlans リモートの **live** プラン (墓標は含めない)
 * @param remoteTombstoneIds リモートで deleted=true になっているプランの ID 集合
 */
export function mergePlans(
    localPlans: SavedPlan[],
    remotePlans: SavedPlan[],
    remoteTombstoneIds: Set<string>,
): MergeResult {
    const remoteMap = new Map(remotePlans.map((p) => [p.id, p]));
    const localMap = new Map(localPlans.map((p) => [p.id, p]));

    const merged: SavedPlan[] = [];
    let changed = false;

    for (const local of localPlans) {
        // 墓標が最優先: 他端末で削除された → ローカルからも除去
        if (remoteTombstoneIds.has(local.id)) {
            changed = true;
            continue;
        }
        const remote = remoteMap.get(local.id);
        if (remote) {
            // 両方に存在 → updatedAt が新しい方 (Last Writer Wins)
            if (remote.updatedAt > local.updatedAt) {
                merged.push(remote);
                changed = true;
            } else {
                merged.push(local);
            }
        } else {
            // リモートに live 無し + 墓標無し = 未同期 → drop せず保持 (次回キューで再送)
            merged.push(local);
        }
    }

    // リモートのみの live プラン (他端末で作成) → 追加
    for (const remote of remotePlans) {
        if (!localMap.has(remote.id)) {
            merged.push(remote);
            changed = true;
        }
    }

    merged.sort((a, b) => b.updatedAt - a.updatedAt);
    return { merged, changed };
}
