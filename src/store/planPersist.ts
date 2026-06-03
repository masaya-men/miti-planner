/**
 * プラン永続化ヘルパ (2026-06-03)
 *
 * 同期インテント (_dirtyPlanIds = 未保存 / _deletedPlanIds = 削除済み) を
 * localStorage に永続化し、リロードを跨いで保持する。
 *
 * 背景: これらは Set のため JSON 化できず、これまで persist 対象外だった。
 * その結果リロードで失われ、「削除→リロードで一瞬復活」「未保存編集の消失」の
 * 窓が残っていた。partialize で Set→配列、merge(rehydrate) で配列→Set に変換して保持する。
 */
import type { SavedPlan } from '../types';

/** 永続化される最小状態 (Set は配列で保存) */
export interface PersistedPlanState {
    plans: SavedPlan[];
    currentPlanId: string | null;
    lastActivePlanId: string | null;
    _dirtyPlanIds: string[];
    _deletedPlanIds: string[];
}

interface PartializeInput {
    plans: SavedPlan[];
    currentPlanId: string | null;
    lastActivePlanId: string | null;
    _dirtyPlanIds: Set<string>;
    _deletedPlanIds: Set<string>;
}

/** persist 対象を抽出 (Set → 配列)。Firestore 同期用の一時状態 (_isSyncing 等) は保存しない。 */
export function partializePlanState(state: PartializeInput): PersistedPlanState {
    return {
        plans: state.plans,
        currentPlanId: state.currentPlanId,
        lastActivePlanId: state.lastActivePlanId,
        _dirtyPlanIds: [...state._dirtyPlanIds],
        _deletedPlanIds: [...state._deletedPlanIds],
    };
}

/**
 * rehydrate 時: 永続データ (配列) を現在の state にマージしつつ Set に戻す。
 * - current の関数・初期値はそのまま保持
 * - 永続データのデータフィールドで上書き
 * - dirty/deleted は配列→Set に変換 (旧データでフィールドが無ければ空 Set)
 */
export function mergePersistedPlanState<T extends Record<string, any>>(
    persisted: unknown,
    current: T,
): T {
    const p = (persisted ?? {}) as Partial<PersistedPlanState> & Record<string, unknown>;
    return {
        ...current,
        ...p,
        _dirtyPlanIds: new Set<string>(Array.isArray(p._dirtyPlanIds) ? p._dirtyPlanIds : []),
        _deletedPlanIds: new Set<string>(Array.isArray(p._deletedPlanIds) ? p._deletedPlanIds : []),
    };
}
