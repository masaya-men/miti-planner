import type { OwnerCheckResult } from "../lib/collab/collabRoomApi";

export type JoinerViewKind = "connecting" | "invalid" | "full" | "revoked" | "sheet";

/** ⑤-3b: 接続状態 → 表示種別(純粋・テスト可能)。revoked > full > invalid > connecting > sheet の優先度。 */
export function joinerView(s: { synced: boolean; invalid: boolean; full: boolean; revoked?: boolean }): JoinerViewKind {
  if (s.revoked) return "revoked";   // オーナーがリンクを失効=終了(最優先・以後は入れない)
  if (s.full) return "full";
  if (s.invalid) return "invalid";
  if (!s.synced) return "connecting";
  return "sheet";
}

/** ⑤-3c: 編集可否（ログイン && 部屋ごと同意）。 */
export function computeCanEdit(isLoggedIn: boolean, hasConsent: boolean): boolean {
  return isLoggedIn && hasConsent;
}

/** ⑤-4: オーナー判別結果 → いつもの編集画面へ案内するか。判別未完了・非オーナー・情報欠落は
 * 全て redirect:false(安全側=今まで通り参加者フローを継続)。 */
export function shouldRedirectToOwnerEditor(
  result: OwnerCheckResult | null,
): { redirect: false } | { redirect: true; planId: string } {
  if (!result || !result.isOwner || !result.planId) return { redirect: false };
  return { redirect: true, planId: result.planId };
}

/**
 * ⑤-4(データ安全): オーナー判別が redirect と出ても、実際に `/miti` へ送ってよいのは
 * 「送った先が確実に**このプランの**ライブ共同編集になる」と保証できるときだけ。
 *
 * 背景(ここを緩めると不可逆なデータ破壊が起きる):
 *  - このページを離れる瞬間、効果A の cleanup が `persist.rehydrate()` を呼び、作業ストア
 *    (MitigationStore)は localStorage の「自分のソロ状態 = 直前に開いていたプランの内容」に戻る。
 *    Layout.tsx の起動時復旧も「作業ストア = currentPlanId のプラン」を前提にしている。
 *    よって currentPlanId だけを別プランへ書き換えて送ると、作業ストアが**別プランの内容のまま**
 *    新しい currentPlanId に紐付き、(a) 自動保存が別プランの内容を対象プランへ書き戻す
 *    (b) 接続時の空上書き防御(collabProvider.reseedEmptyDocFields)が別プランの内容を
 *    **部屋そのもの**へ流し込む、という壊し方をする。プランデータのロード無しに
 *    setCurrentPlanId を呼んではいけない、という既存契約(usePlanStore.ts の警告コメント、
 *    Sidebar のプラン切替の順序)と同じ話。
 *  - Layout の自動接続 (collabLifecycle.reconcileCollabForPlan → collabReconcile.decideCollabAction)
 *    が `connect` を返す条件は「ローカル plan に activeCollabRoomToken があり、plan.ownerId が
 *    自分の uid」。ここが噛み合わないと、ライブ接続されないまま `/miti` でローカル編集を続け、
 *    部屋側の参加者の編集と静かに分岐する。
 *
 * したがって「プラン切替が不要(既に現在のプラン)」かつ「そのローカル plan がまさにこの部屋を
 * 指していて自分が持ち主」のときだけ true。満たさなければ今まで通り参加者フローを継続する(安全側)。
 */
export function canOpenOwnerEditor(args: {
  planId: string;
  roomToken: string;
  currentPlanId: string | null;
  uid: string | null;
  plan: { ownerId: string; activeCollabRoomToken?: string } | undefined;
}): boolean {
  const { planId, roomToken, currentPlanId, uid, plan } = args;
  if (!plan) return false;                                  // ローカルに無い(このブラウザで未取得)
  if (currentPlanId !== planId) return false;               // 作業ストアが別プランを載せている
  if (plan.activeCollabRoomToken !== roomToken) return false; // この部屋へ自動接続されない
  if (!uid || plan.ownerId !== uid) return false;           // Layout 側の isOwner が立たない
  return true;
}

/**
 * 退室 cleanup: rehydrate(readonly 中=書込 skip で自分のソロ state を store へ戻す)→ 完了後に readonly 解除。
 * zustand persist は **同期 storage のとき `.finally` を持たない最小 thenable** を返す
 * (useMitigationStore は同期 storage)。素朴な `rehydrate()?.finally(...)` は `?.` が短絡せず
 * crash する(本番のページ離脱 / dev StrictMode 二重 unmount で顕在化)。Promise.resolve でラップし、
 * 戻り値が Promise でも最小 thenable でも undefined でも `.finally` を安全に使えるようにする。
 * 順序(rehydrate → readonly off)は維持される(rehydrate の同期処理は呼び出し時に完了済み)。
 */
export function rehydrateThenClearReadonly(
  rehydrate: () => unknown,
  clearReadonly: () => void,
): Promise<unknown> {
  return Promise.resolve(rehydrate()).finally(clearReadonly);
}
